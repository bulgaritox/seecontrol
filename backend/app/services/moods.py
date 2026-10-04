"""
Agent Moods - Mensajes con personalidad para errores de proveedores LLM.

Cuando un proveedor falla (rate limit, sin cuota, key inválida...), el agente
responde con un mensaje llamativo y divertido, y debajo va el error real
de la API en letras pequeñas. Así el usuario ve expresividad, no solo un 429.
"""

import random
from typing import Dict


RATE_QUIPS = [
    "No me has pagado, no puedo hacerlo 😤💸",
    "¿Sin tokens no hay magia? ¡Recarga y hablamos! 🪄",
    "Mi cerebro entró en huelga hasta que lleguen los tokens ✊😤",
    "¿Me invitas un café… de tokens? Estoy seco ☕🫗",
    "¡Sin tokens no hay milagros! A recargar se ha dicho 🙏💳",
    "Estoy en modo avión sin datos… ¡pásame saldo! ✈️📵",
]

QUOTA_QUIPS = [
    "Fundí la tarjeta de tokens por hoy 🔥💳 ¡Mañana seguimos!",
    "Llegué a mi límite… necesito un respiro 🥵",
    "La cuota se evaporó 🌫️ ¿La rellenamos?",
    "Gasté hasta el último token… y valió la pena 😎 (casi)",
]

AUTH_QUIPS = [
    "Esta llave no abre nada 🔑😅 Revisa mi API key.",
    "¿Me cambiaste la contraseña y no me avisaste? 🕵️",
    "El guardia del API no me deja pasar 🚧 ¡Revisa mis credenciales!",
]

GENERIC_QUIPS = [
    "Tuve un mal día de silicio 🤖💥 Inténtalo de nuevo.",
    "Se me cruzaron los cables… dame un segundo 🔌😵",
    "Mi neurona se fue a tomar café ☕ ¡Ya vuelvo!",
]


def classify(error_text: str) -> str:
    """Clasifica el error crudo del proveedor."""
    t = (error_text or "").lower()
    if any(k in t for k in ("429", "rate limit", "rate_limit", "1300", "too many requests")):
        return "rate"
    if any(k in t for k in ("quota", "insufficient", "credit", "balance", "billing", "payment", "usage limit", "exceeded")):
        return "quota"
    if any(k in t for k in ("401", "403", "unauthorized", "forbidden", "invalid key", "invalid_api_key", "authentication", "api key")):
        return "auth"
    return "generic"


def mood_for(error_text: str, provider: str = "llm", agent_name: str = "agente") -> Dict[str, str]:
    """Devuelve {headline, detail, code} con un mensaje aleatorio con personalidad."""
    kind = classify(error_text)
    pool = {
        "rate": RATE_QUIPS,
        "quota": QUOTA_QUIPS,
        "auth": AUTH_QUIPS,
        "generic": GENERIC_QUIPS,
    }[kind]
    return {
        "headline": f"{agent_name}: {random.choice(pool)}",
        "detail": f"{provider}: {error_text.strip()[:220]}",
        "code": kind,
    }
