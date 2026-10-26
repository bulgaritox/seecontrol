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
from datetime import datetime

from sqlalchemy import select

from ..models.agent import Agent, AgentStatus
from ..models.task import Task, TaskStatus, TaskPriority
from ..services.llm import llm_service, LLMError
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

    async def _run(
        self,
        provider: str,
        model: str,
        system: str,
        user: str,
        max_tokens: int = CODE_MAX_TOKENS,
    ) -> Tuple[str, int]:
        """Una llamada al LLM con presupuesto alto y reintentos ante rate limit.
        Devuelve (texto, tokens). Los proveedores de inferencia rápida (Groq)
        limitan el free tier cuando reciben varias llamadas seguidas; aquí
        reintentamos con backoff en lugar de fallar toda la delegación."""
        messages = [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ]
        last_err: Optional[LLMError] = None
        for attempt in range(MAX_RETRIES):
            try:
                content, tokens, _ = await llm_service.chat_effective(
                    provider_id=provider,
                    model=model,
                    messages=messages,
                    max_tokens=max_tokens,
                    temperature=CODE_TEMPERATURE,
                )
                return content, tokens
            except LLMError as e:
                last_err = e
                # Solo reintentamos errores marcados como reintentables (rate limit)
                if not e.retryable or attempt == MAX_RETRIES - 1:
                    raise
                wait = RETRY_BACKOFF_BASE * (2 ** attempt)
                logger.warning(
                    "Rate limit en %s/%s (intento %d/%d): espero %.0fs y reintento",
                    provider, model, attempt + 1, MAX_RETRIES, wait,
                )
                await asyncio.sleep(wait)
        # No debería llegar aquí, pero por seguridad
        raise last_err or LLMError(f"{provider}: fallo desconocido", provider)

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
        status: TaskStatus = TaskStatus.COMPLETED,
    ) -> Task:
        """Crea y guarda una subtarea con su provider/model y resultado."""
        task = Task(
            title=parent_title,
            description=description,
            priority=TaskPriority.MEDIUM,
            status=status,
            progress=100.0 if status == TaskStatus.COMPLETED else 0.0,
            agent_id=str(agent.id) if agent else None,
            provider=provider,
            model=model,
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
            # 1) BOSS: estructura HTML (semántica, sin estilos ni lógica aún)
            # ---------------------------------------------------------------
            boss_sys = (
                "Eres Boss, el arquitecto/orquestador del equipo SeeControl. "
                "Tu trabajo es definir la ESTRUCTURA HTML semántica y COMPLETA del documento pedido. "
                "Entrega SOLO el HTML (sin CSS ni JS todavía), usando clases/ids claros que un diseñador "
                "y un desarrollador puedan enganchar después. No omitas secciones. "
                "Responde únicamente con un bloque ```html```."
            )
            boss_user = (
                f"Petición del usuario:\n{request}\n\n"
                "Devuelve la estructura HTML completa (document skeleton con <head> y <body>), "
                "con todos los contenedores, columnas y elementos necesarios, usando clases e ids "
                "descriptivos. No incluyas <style> ni <script> con lógica: solo marcadores/placeholders "
                "y los enganches (ids/clases) para CSS y JS."
            )
            html_raw, t = await self._run(boss_p, boss_m, boss_sys, boss_user)
            total_tokens += t
            html_struct = _extract_block(html_raw, "html")
            steps.append({"agent": "Boss", "role": "HTML", "provider": boss_p, "model": boss_m, "tokens": t})
            st = await self._persist_subtask(
                db, "HTML (estructura) · Boss", request, boss, boss_p, boss_m, html_struct, t, user_id, workspace_id,
            )
            subtask_ids.append(str(st.id))

            # ---------------------------------------------------------------
            # 2) PIXEL: CSS a partir de la estructura
            # ---------------------------------------------------------------
            await asyncio.sleep(STEP_SPACING)  # no saturar el rate limit del proveedor
            pixel_sys = (
                "Eres Pixel, diseñador del equipo SeeControl. Recibes una estructura HTML y entregas "
                "el CSS COMPLETO para darle estilo (layout, colores, tipografía, estados hover, responsive "
                "si aplica). No cambies la estructura; solo estiliza las clases/ids existentes. "
                "Responde únicamente con un bloque ```css```."
            )
            pixel_user = (
                f"Petición original:\n{request}\n\n"
                f"Estructura HTML a estilizar:\n```html\n{html_struct}\n```\n\n"
                "Devuelve el CSS completo para esta estructura. Que sea limpio, moderno y usable."
            )
            css_raw, t = await self._run(pixel_p, pixel_m, pixel_sys, pixel_user)
            total_tokens += t
            css_code = _extract_block(css_raw, "css")
            steps.append({"agent": "Pixel", "role": "CSS", "provider": pixel_p, "model": pixel_m, "tokens": t})
            st = await self._persist_subtask(
                db, "CSS (diseño) · Pixel", request, pixel, pixel_p, pixel_m, css_code, t, user_id, workspace_id,
            )
            subtask_ids.append(str(st.id))

            # ---------------------------------------------------------------
            # 3) MAX: JavaScript (lógica) a partir de la estructura
            # ---------------------------------------------------------------
            await asyncio.sleep(STEP_SPACING)  # no saturar el rate limit del proveedor
            max_sys = (
                "Eres Max, desarrollador del equipo SeeControl. Recibes una estructura HTML y entregas "
                "el JavaScript COMPLETO y funcional que implementa toda la lógica pedida (eventos, estado, "
                "persistencia, CRUD, etc.). Engancha a los ids/clases existentes. No reescribas el HTML. "
                "Responde únicamente con un bloque ```javascript```."
            )
            max_user = (
                f"Petición original:\n{request}\n\n"
                f"Estructura HTML sobre la que trabajar:\n```html\n{html_struct}\n```\n\n"
                "Devuelve el JavaScript completo que hace funcionar todo lo pedido. "
                "Incluye TODA la lógica, sin dejar funciones a medias ni TODOs."
            )
            js_raw, t = await self._run(max_p, max_m, max_sys, max_user)
            total_tokens += t
            js_code = _extract_block(js_raw, "javascript", "js")
            steps.append({"agent": "Max", "role": "JS", "provider": max_p, "model": max_m, "tokens": t})
            st = await self._persist_subtask(
                db, "JavaScript (lógica) · Max", request, max_dev, max_p, max_m, js_code, t, user_id, workspace_id,
            )
            subtask_ids.append(str(st.id))

            # ---------------------------------------------------------------
            # 4) BOSS: ensamblado determinista (sin volver a llamar al LLM
            #    para no arriesgar truncado en el documento más grande).
            # ---------------------------------------------------------------
            final_html = self._assemble(html_struct, css_code, js_code)

            # Subtarea final de entrega (boss)
            final_task = await self._persist_subtask(
                db, "Entregable final (ensamblado) · Boss", request, boss, boss_p, boss_m,
                final_html, 0, user_id, workspace_id,
            )
            subtask_ids.append(str(final_task.id))

            logger.info(
                "Delegación completada: boss=%s/%s pixel=%s/%s max=%s/%s tokens=%d",
                boss_p, boss_m, pixel_p, pixel_m, max_p, max_m, total_tokens,
            )

            return {
                "ok": True,
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
            }

    def _assemble(self, html_struct: str, css_code: str, js_code: str) -> str:
        """Inserta CSS y JS en la estructura HTML. Si la estructura ya es un
        documento completo, inyecta <style> en <head> y <script> antes de </body>.
        Si no, construye un documento mínimo alrededor."""
        html = (html_struct or "").strip()
        style_tag = f"<style>\n{css_code}\n</style>" if css_code else ""
        script_tag = f"<script>\n{js_code}\n</script>" if js_code else ""

        has_doc = "<html" in html.lower()
        if has_doc:
            # Inyecta estilo en </head> (o al inicio si no hay head)
            if style_tag:
                if re.search(r"</head>", html, re.IGNORECASE):
                    html = re.sub(r"</head>", style_tag + "\n</head>", html, count=1, flags=re.IGNORECASE)
                else:
                    html = style_tag + "\n" + html
            # Inyecta script antes de </body> (o al final)
            if script_tag:
                if re.search(r"</body>", html, re.IGNORECASE):
                    html = re.sub(r"</body>", script_tag + "\n</body>", html, count=1, flags=re.IGNORECASE)
                else:
                    html = html + "\n" + script_tag
            return html

        # Documento mínimo envolviendo el fragmento
        return (
            "<!DOCTYPE html>\n<html lang=\"es\">\n<head>\n"
            "<meta charset=\"UTF-8\">\n"
            "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n"
            "<title>SeeControl</title>\n"
            f"{style_tag}\n</head>\n<body>\n{html}\n{script_tag}\n</body>\n</html>"
        )


# Singleton
delegation_service = DelegationService()
