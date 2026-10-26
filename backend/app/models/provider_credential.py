"""
ProviderCredential Model
Una credencial (API key) gestionable desde la UI para un proveedor LLM.
Permite múltiples keys por proveedor, con nombre/etiqueta y una activa.
Para proveedores "custom" guarda también api_url, label y los modelos.
"""

from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, Text, Boolean, JSON
from typing import List, Optional

from .base import Base, BaseModel


class ProviderCredential(Base, BaseModel):
    """Credencial de un proveedor LLM, gestionada desde la interfaz."""

    __tablename__ = "provider_credentials"

    # id del proveedor (groq, nvidia, cloudflare, … o un id custom)
    provider_id: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    # nombre/etiqueta legible de la key (p.ej. "granredy", "publicmovie")
    label: Mapped[str] = mapped_column(String(100), nullable=False)
    api_key: Mapped[str] = mapped_column(Text, nullable=False)
    # ¿es la key activa para ese proveedor?
    is_active: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Para proveedores custom creados desde la UI:
    is_custom: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    label_display: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)  # nombre del proveedor custom
    api_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    models: Mapped[List[str]] = mapped_column(JSON, default=list, nullable=False)

    # ámbito
    user_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    def __repr__(self) -> str:
        return f"<ProviderCredential(provider={self.provider_id}, label={self.label}, active={self.is_active})>"
