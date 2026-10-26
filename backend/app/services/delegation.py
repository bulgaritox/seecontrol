"""
Delegation Service
El agente orquestador ("boss") descompone una petición de generación de código
y delega subtareas a agentes especializados (pixel = diseño/CSS, max = lógica/JS),
quedándose boss con la estructura (HTML). Luego ensambla el entregable final.

Diseñado para NO truncar:
- Cada llamada al LLM usa un presupuesto de tokens alto (configurable).
- Soporta override de provider/model desde la UI (Studio): el modelo elegido
  se impone al configurado por defecto en cada agente.
- Persiste en cada Task el provider/model realmente usado para trazabilidad.
"""

from typing import Optional, Dict, Any, List, Tuple
import asyncio
import logging
import re
import uuid
from datetime import datetime

from sqlalchemy import select

from ..models.agent import Agent, AgentStatus
from ..models.task import Task, TaskStatus, TaskPriority
from ..services.llm import llm_service, LLMError
from ..services.artifacts import ArtifactStore
from ..config.database import AsyncSessionLocal

logger = logging.getLogger(__name__)

# Presupuesto de tokens generoso para que el código NO se corte.
# Groq y la mayoría de proveedores OpenAI-compatible aceptan estos valores.
CODE_MAX_TOKENS = 8000
# Temperatura baja para código determinista.
CODE_TEMPERATURE = 0.3
# Reintentos ante rate limit (proveedores rápidos como Groq limitan el free tier
# cuando llegan varias llamadas seguidas). Backoff exponencial simple.
MAX_RETRIES = 3
RETRY_BACKOFF_BASE = 2.0  # segundos: 2, 4, 8
# Pausa entre subtareas delegadas para no saturar el rate limit del proveedor.
STEP_SPACING = 1.5
# Tope DURO por llamada LLM: si un proveedor no responde en este tiempo, se corta
# y se prueba el siguiente (evita que la misión se congele para siempre).
HARD_CALL_TIMEOUT = 75.0


_NUM_WORDS = {
    "un": 1, "uno": 1, "una": 1, "dos": 2, "tres": 3, "cuatro": 4, "cinco": 5,
    "1": 1, "2": 2, "3": 3, "4": 4, "5": 5,
}


def _parse_agent_cap(request: str, default: int = 3) -> int:
    """Lee de la petición un límite de agentes a delegar.
    Reconoce frases como 'máximo dos agentes', 'hasta 2 agentes', 'solo 1 agente'.
    Devuelve un entero entre 1 y 3 (el flujo soporta hasta 3: Boss+Pixel+Max)."""
    txt = request.lower()
    # Patrón: (maximo|hasta|solo|solamente|no más de) <num> agente(s)
    m = re.search(
        r"(?:m[aá]ximo|hasta|solo|s[oó]lo|no m[aá]s de|un m[aá]ximo de)\s+(\w+)\s+agent",
        txt,
    )
    if m:
        tok = m.group(1)
        if tok in _NUM_WORDS:
            return max(1, min(3, _NUM_WORDS[tok]))
    # Patrón genérico: "<num> agentes"
    m = re.search(r"\b(\w+)\s+agentes?\b", txt)
    if m and m.group(1) in _NUM_WORDS:
        return max(1, min(3, _NUM_WORDS[m.group(1)]))
    return default


def _wants_tailwind(request: str) -> bool:
    return "tailwind" in request.lower()


def _extract_block(text: str, *langs: str) -> str:
    """Extrae el contenido de un bloque ```lang ... ``` si existe.
    Si no hay fences, devuelve el texto tal cual (ya recortado)."""
    if not text:
        return ""
    # Busca el primer fence con alguno de los lenguajes pedidos
    for lang in langs:
        pattern = rf"```{lang}\s*\n(.*?)```"
        m = re.search(pattern, text, re.DOTALL | re.IGNORECASE)
        if m:
            return m.group(1).strip()
    # Fence genérico
    m = re.search(r"```[a-zA-Z0-9]*\s*\n(.*?)```", text, re.DOTALL)
    if m:
        return m.group(1).strip()
    return text.strip()


class DelegationService:
    """Orquesta la generación de código delegando a agentes especializados."""

    async def _agents_by_type(self, db, workspace_id: str) -> Dict[str, Agent]:
        """Devuelve un dict character_type -> Agent para el workspace."""
        result = await db.execute(
            select(Agent).where(Agent.workspace_id == workspace_id)
        )
        agents = result.scalars().all()
        out: Dict[str, Agent] = {}
        for a in agents:
            out[(a.character_type or "").lower()] = a
        return out

    async def _skill_guidance(self, db, agent: Optional[Agent], workspace_id: str) -> str:
        """Carga las instrucciones de las skills adjuntas a un agente y las
        formatea para inyectarlas en su prompt. Así el agente 'usa' la skill."""
        if not agent or not agent.skills:
            return ""
        from ..models.skill import Skill
        result = await db.execute(
            select(Skill).where(Skill.workspace_id == workspace_id)
        )
        all_skills = {s.name: s for s in result.scalars().all()}
        blocks: List[str] = []
        for name in agent.skills:
            s = all_skills.get(name)
            if not s or not s.is_active:
                continue
            instr = (s.instructions or "").strip()
            if not instr:
                continue
            blocks.append(f"### SKILL: {s.name}\n{s.description or ''}\n{instr[:4000]}")
        if not blocks:
            return ""
        return (
            "\n\n=== GUÍA DE SKILLS ADJUNTAS (debes SEGUIR estas directrices) ===\n"
            + "\n\n".join(blocks)
            + "\n=== FIN GUÍA DE SKILLS ===\n"
        )

    async def _resolve_model(
        self,
        agent: Optional[Agent],
        override_provider: Optional[str],
        override_model: Optional[str],
        fallback_provider: str = "groq",
        fallback_model: str = "openai/gpt-oss-20b",
    ) -> Tuple[str, str]:
        """Resuelve (provider, model) con esta prioridad:
        1) override de la UI (Studio) — se IMPONE al modelo del agente.
        2) el provider/model configurado en el agente.
        3) fallback global.
        """
        if override_provider and override_model:
            return override_provider.lower(), override_model
        if agent and agent.provider and agent.model:
            return agent.provider.lower(), agent.model
        return fallback_provider, fallback_model

    def _fallback_chain(self, exclude_provider: str = "") -> List[Tuple[str, str]]:
        """Construye una lista de (provider, model) de RESPALDO entre los
        proveedores habilitados (con API key efectiva), para que si el principal
        falla/cuelga, la delegación siga con otro. Prioriza proveedores estables."""
        from ..config.llm import provider_enabled, effective_models
        # Orden de preferencia para fallback (estables primero).
        order = ["mistral", "vercel", "nvidia", "openrouter", "cloudflare", "groq", "gemini"]
        chain: List[Tuple[str, str]] = []
        for pid in order:
            if pid == (exclude_provider or "").lower():
                continue
            try:
                if not provider_enabled(pid):
                    continue
                models = effective_models(pid)
                if models:
                    chain.append((pid, models[0]))
            except Exception:
                continue
        return chain

    async def _call_once(self, provider: str, model: str, messages, max_tokens: int) -> Tuple[str, int]:
        """Una sola llamada con tope DURO de tiempo (asyncio.wait_for) para que
        un proveedor colgado NUNCA congele la delegación."""
        content, tokens, _ = await asyncio.wait_for(
            llm_service.chat_effective(
                provider_id=provider,
                model=model,
                messages=messages,
                max_tokens=max_tokens,
                temperature=CODE_TEMPERATURE,
            ),
            timeout=HARD_CALL_TIMEOUT,
        )
        if not (content or "").strip():
            raise LLMError(f"{provider}: respuesta vacía", provider, retryable=True)
        return content, tokens

    async def _run(
        self,
        provider: str,
        model: str,
        system: str,
        user: str,
        max_tokens: int = CODE_MAX_TOKENS,
        fallbacks: Optional[List[Tuple[str, str]]] = None,
    ) -> Tuple[str, int, str, str]:
        """Llama al LLM con: (1) reintentos con backoff ante rate limit, y
        (2) FALLBACK a otros proveedores/modelos si el principal falla o cuelga.
        Devuelve (texto, tokens, provider_usado, model_usado).

        'fallbacks' es una lista de (provider, model) a probar en orden si el
        principal no responde. Así, si Groq/gpt-oss-20b se cuelga, pasa al
        siguiente sin congelarse ni abortar toda la misión."""
        messages = [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ]
        # Cadena a intentar: principal + fallbacks (sin duplicados)
        chain: List[Tuple[str, str]] = [(provider, model)]
        for pm in (fallbacks or []):
            if pm not in chain and pm[0] and pm[1]:
                chain.append(pm)

        last_err: Optional[Exception] = None
        for (prov, mod) in chain:
            for attempt in range(MAX_RETRIES):
                try:
                    content, tokens = await self._call_once(prov, mod, messages, max_tokens)
                    if (prov, mod) != (provider, model):
                        logger.info("Fallback OK: usé %s/%s en vez de %s/%s", prov, mod, provider, model)
                    return content, tokens, prov, mod
                except asyncio.TimeoutError:
                    last_err = LLMError(f"{prov}/{mod}: timeout duro ({HARD_CALL_TIMEOUT}s)", prov, retryable=True)
                    logger.warning("Timeout duro en %s/%s (intento %d/%d) → siguiente",
                                   prov, mod, attempt + 1, MAX_RETRIES)
                    break  # no reintentar el mismo si cuelga; pasa al siguiente provider
                except LLMError as e:
                    last_err = e
                    if not e.retryable or attempt == MAX_RETRIES - 1:
                        logger.warning("Fallo en %s/%s: %s → siguiente provider", prov, mod, e.message)
                        break
                    wait = RETRY_BACKOFF_BASE * (2 ** attempt)
                    logger.warning("Reintentable en %s/%s (%d/%d): espero %.0fs",
                                   prov, mod, attempt + 1, MAX_RETRIES, wait)
                    await asyncio.sleep(wait)
                except Exception as e:  # pragma: no cover
                    last_err = e
                    logger.warning("Error inesperado en %s/%s: %s → siguiente", prov, mod, e)
                    break
        raise last_err or LLMError(f"{provider}: todos los proveedores fallaron", provider)

    async def _persist_subtask(
        self,
        db,
        parent_title: str,
        description: str,
        agent: Optional[Agent],
        provider: str,
        model: str,
        result: str,
        tokens: int,
        user_id: str,
        workspace_id: str,
        project_id: str,
        project_name: str,
        project_brief: str,
        role_label: str,
        status: TaskStatus = TaskStatus.COMPLETED,
    ) -> Task:
        """Crea y guarda una subtarea con su provider/model, resultado y la
        información de proyecto (tag + brief general) que la agrupa."""
        task = Task(
            title=parent_title,
            description=description,
            priority=TaskPriority.MEDIUM,
            status=status,
            progress=100.0 if status == TaskStatus.COMPLETED else 0.0,
            agent_id=str(agent.id) if agent else None,
            provider=provider,
            model=model,
            project_id=project_id,
            project_name=project_name,
            project_brief=project_brief,
            role_label=role_label,
            result=(result or "")[:20000],
            tokens_used=tokens,
            user_id=user_id,
            workspace_id=workspace_id,
            completed_at=datetime.utcnow() if status == TaskStatus.COMPLETED else None,
        )
        db.add(task)
        await db.commit()
        await db.refresh(task)
        return task

    async def _plan_project(
        self,
        request: str,
        provider: str,
        model: str,
    ) -> Tuple[str, str]:
        """El orquestador define automáticamente el NOMBRE/TAG del proyecto y un
        BRIEF general (el "paper" que comparten todos los agentes). Devuelve
        (project_name, project_brief).

        Planificador de proyecto de Boss: en vez de pedir un JSON (frágil), pide
        TEXTO PLANO en dos llamadas simples (título y brief), que los LLM cumplen
        de forma mucho más fiable. Heurística local como respaldo."""
        # 1) Título corto del proyecto (texto plano, una sola línea)
        name = ""
        try:
            title_sys = (
                "Eres Boss, orquestador de SeeControl. Tu tarea: crear un TÍTULO de "
                "proyecto corto y descriptivo (2 a 5 palabras) a partir de la petición. "
                "Responde SOLO con el título, sin comillas, sin prefijos, sin punto final. "
                "Ejemplos: 'Landing Solvedia en Construcción', 'Dashboard de Ventas', "
                "'Gestor Kanban'."
            )
            raw_name, _, _, _ = await self._run(
                provider, model, title_sys, f"Petición:\n{request}",
                max_tokens=40, fallbacks=self._fallback_chain(provider),
            )
            name = self._clean_title(raw_name)
        except Exception as e:  # pragma: no cover
            logger.warning("Planner título LLM falló (%s); uso heurística", e)
        if not name:
            name = self._heuristic_name(request)

        # 2) Brief general (texto plano, 2-4 frases)
        brief = ""
        try:
            brief_sys = (
                "Eres Boss, orquestador de SeeControl. Resume en 2-4 frases el OBJETIVO "
                "global del proyecto y cómo deben encajar las partes (estructura HTML, "
                "diseño/CSS y lógica/JS) para que al ensamblar no queden huecos. "
                "Responde en texto plano, sin listas ni markdown."
            )
            raw_brief, _, _, _ = await self._run(
                provider, model, brief_sys, f"Petición:\n{request}",
                max_tokens=300, fallbacks=self._fallback_chain(provider),
            )
            brief = (raw_brief or "").strip()
        except Exception as e:  # pragma: no cover
            logger.warning("Planner brief LLM falló (%s); uso petición como brief", e)
        if not brief:
            brief = request.strip()

        return name[:160], brief

    @staticmethod
    def _clean_title(raw: str) -> str:
        """Limpia la respuesta del LLM para dejar un título usable."""
        if not raw:
            return ""
        t = raw.strip()
        # toma solo la primera línea no vacía
        for line in t.split("\n"):
            line = line.strip().strip("`").strip()
            if line:
                t = line
                break
        # quita markdown (**bold**, *, `, #), prefijos tipo "Título:" y comillas
        t = t.strip().strip("*`#").strip()
        t = re.sub(r'^(t[íi]tulo|project|proyecto)\s*[:\-]\s*', "", t, flags=re.IGNORECASE)
        t = re.sub(r'[*`_#]+', "", t)  # cualquier resto de markdown
        t = t.strip().strip("\"'").rstrip(".,;:").strip()
        # si el modelo devolvió algo larguísimo, recorta a las primeras ~6 palabras
        words = t.split(" ")
        if len(words) > 8:
            t = " ".join(words[:8])
        return t[:80]

    @staticmethod
    def _heuristic_name(request: str) -> str:
        """Genera un nombre de proyecto decente sin LLM (título legible)."""
        txt = re.sub(r"\s+", " ", request.strip())
        # ¿Hay un nombre propio explícito? "llamada/llamado/nombre X"
        m = re.search(r"\b(?:llamad[oa]|nombre|titulad[oa])\s+['\"]?([A-Za-z0-9\-_]{3,40})", txt, re.IGNORECASE)
        if m:
            return m.group(1).strip().rstrip(",.").strip()[:60]
        # Quita el verbo inicial (crea/haz/genera/diseña/construye...) y artículos
        cleaned = re.sub(
            r"^(crea|haz|genera|dise[ñn]a|construye|desarrolla|arma|monta)\s+(un[ao]s?\s+)?",
            "", txt, flags=re.IGNORECASE,
        )
        # Corta en el primer conector de detalle para quedarnos con el "qué"
        cleaned = re.split(r"\b(con|que|usando|utiliza|,|\.)\b", cleaned, flags=re.IGNORECASE)[0].strip()
        words = cleaned.split(" ")[:6]
        title = " ".join(words).strip().rstrip(",.").strip()
        if title:
            return title[:60].capitalize()
        return "Proyecto"

    @staticmethod
    def _as_text(value: Any) -> str:
        """Convierte a texto cualquier valor que el LLM devuelva para un campo
        (a veces manda objetos/listas en vez de strings)."""
        if value is None:
            return ""
        if isinstance(value, str):
            return value
        if isinstance(value, (list, tuple)):
            return " · ".join(DelegationService._as_text(v) for v in value if v)
        if isinstance(value, dict):
            # Une los valores de texto del dict (p. ej. {objetivo:..., partes:...})
            parts = []
            for v in value.values():
                t = DelegationService._as_text(v)
                if t:
                    parts.append(t)
            return "\n".join(parts)
        return str(value)

    @staticmethod
    def _parse_json(text: str) -> Dict[str, Any]:
        """Extrae un objeto JSON de la respuesta del LLM (tolerante a fences y a
        saltos de línea literales dentro de strings, que rompen json.loads)."""
        import json
        t = (text or "").strip()
        m = re.search(r"```(?:json)?\s*\n(.*?)```", t, re.DOTALL)
        if m:
            t = m.group(1).strip()
        # Intenta encontrar el primer {...}
        m = re.search(r"\{.*\}", t, re.DOTALL)
        if m:
            t = m.group(0)
        try:
            return json.loads(t)
        except json.JSONDecodeError:
            # Reintento tolerante: strict=False permite caracteres de control
            # (saltos de línea/tabs) dentro de los strings del JSON.
            return json.loads(t, strict=False)

    async def generate_code(
        self,
        request: str,
        workspace_id: str,
        user_id: str,
        override_provider: Optional[str] = None,
        override_model: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Flujo de delegación real para generación de código.

        boss  -> estructura HTML (el esqueleto del documento)
        pixel -> CSS (diseño)
        max   -> JavaScript (lógica)
        boss  -> ensambla el entregable final en un solo archivo.

        El override de provider/model (desde Studio) se impone a TODOS los
        agentes para esta ejecución; si no hay override, cada agente usa el
        suyo.
        """
        agent_cap = _parse_agent_cap(request, default=3)
        use_tailwind = _wants_tailwind(request)

        async with AsyncSessionLocal() as db:
            by_type = await self._agents_by_type(db, workspace_id)
            boss = by_type.get("boss")
            pixel = by_type.get("pixel")
            max_dev = by_type.get("max")

            steps: List[Dict[str, Any]] = []
            total_tokens = 0
            subtask_ids: List[str] = []

            # Modelos efectivos por agente (override UI tiene prioridad)
            boss_p, boss_m = await self._resolve_model(boss, override_provider, override_model)
            pixel_p, pixel_m = await self._resolve_model(pixel, override_provider, override_model)
            max_p, max_m = await self._resolve_model(max_dev, override_provider, override_model)

            # ---------------------------------------------------------------
            # 0) BOSS: define el PROYECTO (tag + brief general) automáticamente.
            # ---------------------------------------------------------------
            project_id = uuid.uuid4().hex
            project_name, project_brief = await self._plan_project(request, boss_p, boss_m)
            logger.info(
                "Proyecto '%s' (%s) · agentes=%d · tailwind=%s",
                project_name, project_id, agent_cap, use_tailwind,
            )

            # Carpeta temporal del proyecto: Boss deja el brief y cada agente
            # escribirá ahí su devolución; Boss las lee de vuelta al ensamblar.
            store = ArtifactStore(project_id)
            store.write_brief(project_name, project_brief, request)

            # Guía de skills adjuntas por agente (p. ej. "cosmic" en Boss/Pixel).
            boss_skills = await self._skill_guidance(db, boss, workspace_id)
            pixel_skills = await self._skill_guidance(db, pixel, workspace_id)
            max_skills = await self._skill_guidance(db, max_dev, workspace_id)
            used_skills: List[str] = []
            for ag in (boss, pixel, max_dev):
                if ag and ag.skills:
                    used_skills.extend(ag.skills)
            used_skills = sorted(set(used_skills))

            # Tarea "paraguas" del proyecto: se crea YA (in_progress) para que el
            # proyecto aparezca en el Kanban aunque un paso posterior falle.
            mission_task = await self._persist_subtask(
                db, f"Misión · {project_name}", request, boss, boss_p, boss_m,
                "", 0, user_id, workspace_id,
                project_id=project_id, project_name=project_name, project_brief=project_brief,
                role_label="MISIÓN", status=TaskStatus.IN_PROGRESS,
            )
            subtask_ids.append(str(mission_task.id))

            tw_note = (
                "El sitio usa TAILWIND CSS vía CDN (ya incluido en el <head>). "
                "Usa clases utilitarias de Tailwind directamente en el HTML. "
                if use_tailwind else ""
            )

            # Guardará qué agentes participaron realmente (para el resumen)
            delegated: List[str] = ["Boss"]

            # ---------------------------------------------------------------
            # 1) BOSS: estructura HTML (con Tailwind inline si aplica)
            # ---------------------------------------------------------------
            boss_sys = (
                "Eres Boss, el arquitecto/orquestador del equipo SeeControl. "
                "Defines la ESTRUCTURA HTML semántica y COMPLETA del documento pedido. "
                + (
                    "Aplica clases utilitarias de TAILWIND directamente en el HTML para el layout base. "
                    if use_tailwind else
                    "Entrega SOLO el HTML (sin CSS ni JS todavía), con clases/ids claros para enganchar después. "
                )
                + "No omitas secciones. Responde únicamente con un bloque ```html```."
            )
            boss_user = (
                f"PROYECTO: {project_name}\n"
                f"BRIEF GENERAL:\n{project_brief}\n\n"
                f"{tw_note}"
                f"Petición del usuario:\n{request}\n\n"
                "Devuelve la estructura HTML completa (document skeleton con <head> y <body>), "
                "con TODAS las secciones, categorías y elementos pedidos (no resumas ni uses '...'), "
                "usando clases e ids descriptivos."
                + ("" if use_tailwind else " No incluyas <style> ni <script>: solo enganches (ids/clases).")
                + boss_skills
            )
            html_raw, t, up, um = await self._run(
                boss_p, boss_m, boss_sys, boss_user, fallbacks=self._fallback_chain(boss_p),
            )
            total_tokens += t
            html_struct = _extract_block(html_raw, "html")
            store.write_return("Boss", "HTML", "boss_html.html", html_struct)
            steps.append({"agent": "Boss", "role": "HTML", "provider": up, "model": um, "tokens": t})
            st = await self._persist_subtask(
                db, "HTML (estructura) · Boss", request, boss, up, um, html_struct, t, user_id, workspace_id,
                project_id=project_id, project_name=project_name, project_brief=project_brief, role_label="HTML",
            )
            subtask_ids.append(str(st.id))

            css_code = ""
            js_code = ""
            partial_error: Optional[str] = None

            try:
                if agent_cap >= 3 and not use_tailwind:
                    # === FLUJO 3 AGENTES: Boss(HTML) + Pixel(CSS) + Max(JS) ===
                    await asyncio.sleep(STEP_SPACING)
                    css_code, t = await self._do_css(
                        db, pixel, pixel_p, pixel_m, request, project_name, project_brief,
                        html_struct, user_id, workspace_id, project_id, store, pixel_skills,
                    )
                    total_tokens += t
                    _pp, _pm = self._last_pm
                    steps.append({"agent": "Pixel", "role": "CSS", "provider": _pp, "model": _pm, "tokens": t})
                    subtask_ids.append(str(self._last_task_id))
                    delegated.append("Pixel")

                    await asyncio.sleep(STEP_SPACING)
                    js_code, t = await self._do_js(
                        db, max_dev, max_p, max_m, request, project_name, project_brief,
                        html_struct, user_id, workspace_id, project_id, store,
                    )
                    total_tokens += t
                    _mp, _mm = self._last_pm
                    steps.append({"agent": "Max", "role": "JS", "provider": _mp, "model": _mm, "tokens": t})
                    subtask_ids.append(str(self._last_task_id))
                    delegated.append("Max")

                else:
                    # === FLUJO 2 AGENTES (o Tailwind): Boss(HTML) + Max(estilos+JS) ===
                    # Con Tailwind los estilos van en el HTML, así que solo falta
                    # pulir diseño/JS: lo hace un único especialista (Max).
                    await asyncio.sleep(STEP_SPACING)
                    role = "DISEÑO+JS" if use_tailwind else "CSS+JS"
                    spec_sys = (
                        "Eres Max, desarrollador full-stack del equipo SeeControl. "
                        "Recibes una estructura HTML y la completas para que quede lista para producción. "
                        + (
                            "Pule el diseño refinando/añadiendo clases de TAILWIND (responsive, hover, spacing, "
                            "colores coherentes) y añade el JavaScript necesario. "
                            if use_tailwind else
                            "Añade el CSS necesario dentro de una etiqueta <style> y el JavaScript dentro de <script>. "
                        )
                        + "Devuelve el DOCUMENTO HTML COMPLETO y funcional en un solo bloque ```html``` "
                        "(con <style>/<script> embebidos según corresponda). No uses '...' ni dejes TODOs."
                    )
                    spec_user = (
                        f"PROYECTO: {project_name}\n"
                        f"BRIEF GENERAL:\n{project_brief}\n\n"
                        f"{tw_note}"
                        f"Petición original:\n{request}\n\n"
                        f"Estructura HTML base:\n```html\n{html_struct}\n```\n\n"
                        "Entrega el index.html final completo, responsive y funcional."
                        # En modo 2 agentes Max hace también el diseño: aplica las
                        # skills de diseño (de Pixel) además de las suyas.
                        + pixel_skills + max_skills
                    )
                    full_raw, t, up, um = await self._run(
                        max_p, max_m, spec_sys, spec_user, fallbacks=self._fallback_chain(max_p),
                    )
                    total_tokens += t
                    full_doc = _extract_block(full_raw, "html")
                    store.write_return("Max", role, "max_full.html", full_doc)
                    steps.append({"agent": "Max", "role": role, "provider": up, "model": um, "tokens": t})
                    st = await self._persist_subtask(
                        db, f"{role} · Max", request, max_dev, up, um, full_doc, t, user_id, workspace_id,
                        project_id=project_id, project_name=project_name, project_brief=project_brief, role_label=role,
                    )
                    subtask_ids.append(str(st.id))
                    delegated.append("Max")
                    # En modo 2 agentes, Max ya entrega el documento completo.
                    html_struct = full_doc
            except LLMError as e:
                # Un paso de delegación falló (rate limit / proveedor). No perdemos
                # el proyecto ni el HTML ya generado: ensamblamos lo que haya.
                partial_error = e.message
                logger.warning("Delegación parcial (se entrega lo disponible): %s", e.message)

            # ---------------------------------------------------------------
            # ENSAMBLADO final (determinista) — Boss LEE DE VUELTA las
            # devoluciones de la carpeta temporal y las conecta.
            # ---------------------------------------------------------------
            # En modo 2 agentes, Max entregó el documento completo (max_full.html).
            # En modo 3 agentes, Boss toma html+css+js de disco.
            disk_full = store.read("max_full.html")
            if disk_full.strip():
                final_html = self._assemble(disk_full, "", "", use_tailwind)
            else:
                disk_html = store.read("boss_html.html") or html_struct
                disk_css = store.read("pixel_css.css") or css_code
                disk_js = store.read("max_js.js") or js_code
                final_html = self._assemble(disk_html, disk_css, disk_js, use_tailwind)

            store.write_return("Boss", "ENTREGA", "final.html", final_html)
            artifacts = store.relative_files()

            final_task = await self._persist_subtask(
                db, "Entregable final (ensamblado) · Boss", request, boss, boss_p, boss_m,
                final_html, 0, user_id, workspace_id,
                project_id=project_id, project_name=project_name, project_brief=project_brief, role_label="ENTREGA",
            )
            # Guarda el índice de artefactos en la tarea de entrega para la UI
            final_task.result_data = {"artifacts": artifacts, "workspace_dir": f"_workspace/{project_id}"}
            await db.commit()
            subtask_ids.append(str(final_task.id))

            # Cierra la tarea paraguas del proyecto con el entregable final
            mission_task.status = TaskStatus.COMPLETED if not partial_error else TaskStatus.BLOCKED
            mission_task.progress = 100.0
            mission_task.result = final_html[:20000]
            mission_task.completed_at = datetime.utcnow()
            await db.commit()

            logger.info(
                "Delegación completada: proyecto='%s' agentes=%s tailwind=%s tokens=%d",
                project_name, "+".join(delegated), use_tailwind, total_tokens,
            )

            return {
                "ok": True,
                "partial": bool(partial_error),
                "partial_error": partial_error,
                "final": final_html,
                "html": html_struct,
                "css": css_code,
                "js": js_code,
                "steps": steps,
                "subtask_ids": subtask_ids,
                "total_tokens": total_tokens,
                "override": bool(override_provider and override_model),
                "provider": boss_p,
                "model": boss_m,
                "project_id": project_id,
                "project_name": project_name,
                "project_brief": project_brief,
                "agent_cap": agent_cap,
                "tailwind": use_tailwind,
                "delegated": delegated,
                "artifacts": artifacts,
                "workspace_dir": f"_workspace/{project_id}",
                "skills_used": used_skills,
            }

    # Guarda el id y el (provider, model) realmente usados por los helpers _do_*
    _last_task_id: str = ""
    _last_pm: Tuple[str, str] = ("", "")

    async def _do_css(self, db, pixel, pixel_p, pixel_m, request, project_name,
                      project_brief, html_struct, user_id, workspace_id, project_id, store=None, skills=""):
        pixel_sys = (
            "Eres Pixel, diseñador del equipo SeeControl. Recibes una estructura HTML y entregas "
            "el CSS COMPLETO (layout, colores, tipografía, hover, responsive). No cambies la estructura. "
            "Responde únicamente con un bloque ```css```."
        )
        pixel_user = (
            f"PROYECTO: {project_name}\nBRIEF GENERAL:\n{project_brief}\n\n"
            f"Petición original:\n{request}\n\n"
            f"Estructura HTML a estilizar:\n```html\n{html_struct}\n```\n\n"
            "Devuelve el CSS completo, limpio, moderno y responsive."
            + (skills or "")
        )
        css_raw, t, up, um = await self._run(
            pixel_p, pixel_m, pixel_sys, pixel_user, fallbacks=self._fallback_chain(pixel_p),
        )
        css_code = _extract_block(css_raw, "css")
        if store:
            store.write_return("Pixel", "CSS", "pixel_css.css", css_code)
        st = await self._persist_subtask(
            db, "CSS (diseño) · Pixel", request, pixel, up, um, css_code, t, user_id, workspace_id,
            project_id=project_id, project_name=project_name, project_brief=project_brief, role_label="CSS",
        )
        self._last_task_id = str(st.id)
        self._last_pm = (up, um)
        return css_code, t

    async def _do_js(self, db, max_dev, max_p, max_m, request, project_name,
                     project_brief, html_struct, user_id, workspace_id, project_id, store=None):
        max_sys = (
            "Eres Max, desarrollador del equipo SeeControl. Recibes una estructura HTML y entregas "
            "el JavaScript COMPLETO y funcional (eventos, estado, lógica pedida). Engancha a los ids/clases. "
            "No reescribas el HTML. Responde únicamente con un bloque ```javascript```."
        )
        max_user = (
            f"PROYECTO: {project_name}\nBRIEF GENERAL:\n{project_brief}\n\n"
            f"Petición original:\n{request}\n\n"
            f"Estructura HTML sobre la que trabajar:\n```html\n{html_struct}\n```\n\n"
            "Devuelve el JavaScript completo, sin funciones a medias ni TODOs."
        )
        js_raw, t, up, um = await self._run(
            max_p, max_m, max_sys, max_user, fallbacks=self._fallback_chain(max_p),
        )
        js_code = _extract_block(js_raw, "javascript", "js")
        if store:
            store.write_return("Max", "JS", "max_js.js", js_code)
        st = await self._persist_subtask(
            db, "JavaScript (lógica) · Max", request, max_dev, up, um, js_code, t, user_id, workspace_id,
            project_id=project_id, project_name=project_name, project_brief=project_brief, role_label="JS",
        )
        self._last_task_id = str(st.id)
        self._last_pm = (up, um)
        return js_code, t

    _TAILWIND_CDN = '<script src="https://cdn.tailwindcss.com"></script>'

    @staticmethod
    def _finalize_doc(html: str) -> str:
        """Garantiza un documento HTML BIEN FORMADO aunque el modelo haya
        devuelto algo incompleto: DOCTYPE al inicio y cierres </body></html>."""
        h = (html or "").strip()
        low = h.lower()
        if "<!doctype" not in low:
            h = "<!DOCTYPE html>\n" + h
            low = h.lower()
        if "<body" in low and "</body>" not in low:
            h = h + "\n</body>"
            low = h.lower()
        if "<html" in low and "</html>" not in low:
            h = h + "\n</html>"
        return h

    def _assemble(self, html_struct: str, css_code: str, js_code: str, use_tailwind: bool = False) -> str:
        """Inserta CSS/JS (y el CDN de Tailwind si aplica) en la estructura HTML.
        Si ya es un documento completo, inyecta en <head>/</body>; si no, lo envuelve.
        Siempre devuelve un documento bien formado (DOCTYPE + cierres)."""
        html = (html_struct or "").strip()
        style_tag = f"<style>\n{css_code}\n</style>" if css_code else ""
        script_tag = f"<script>\n{js_code}\n</script>" if js_code else ""

        # ¿Ya trae el CDN de Tailwind? Si no y se pidió, lo añadimos.
        need_tw = use_tailwind and "cdn.tailwindcss.com" not in html.lower()

        has_doc = "<html" in html.lower()
        if has_doc:
            head_inject = ""
            if need_tw:
                head_inject += self._TAILWIND_CDN + "\n"
            if style_tag:
                head_inject += style_tag + "\n"
            if head_inject:
                if re.search(r"</head>", html, re.IGNORECASE):
                    html = re.sub(r"</head>", head_inject + "</head>", html, count=1, flags=re.IGNORECASE)
                else:
                    html = head_inject + html
            if script_tag:
                if re.search(r"</body>", html, re.IGNORECASE):
                    html = re.sub(r"</body>", script_tag + "\n</body>", html, count=1, flags=re.IGNORECASE)
                else:
                    html = html + "\n" + script_tag
            return self._finalize_doc(html)

        # Documento mínimo envolviendo el fragmento
        tw = self._TAILWIND_CDN + "\n" if need_tw else ""
        return (
            "<!DOCTYPE html>\n<html lang=\"es\">\n<head>\n"
            "<meta charset=\"UTF-8\">\n"
            "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n"
            "<title>SeeControl</title>\n"
            f"{tw}{style_tag}\n</head>\n<body>\n{html}\n{script_tag}\n</body>\n</html>"
        )


# Singleton
delegation_service = DelegationService()
