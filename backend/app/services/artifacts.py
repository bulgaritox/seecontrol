"""
Artifacts Service
Carpeta temporal de trabajo por proyecto donde cada agente deja su devolución
(.md/.json/.txt/.html/.css/.js). Boss lee de vuelta esos archivos al ensamblar,
cerrando el ciclo de delegación con trazabilidad en disco.

Estructura:
  backend/_workspace/<project_id>/
      brief.md                 (el "paper" general del proyecto)
      manifest.json            (índice de artefactos + metadatos)
      boss_html.html           (devolución de Boss)
      pixel_css.css            (devolución de Pixel)
      max_js.js | max_full.html (devolución de Max)
      final.html               (entregable ensamblado por Boss)
"""

from typing import Dict, Any, List, Optional
import json
import os
from datetime import datetime

# Raíz del workspace de artefactos (hermano de app/, dentro de backend/)
_BASE = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "_workspace")


class ArtifactStore:
    """Gestiona la carpeta temporal de un proyecto."""

    def __init__(self, project_id: str):
        self.project_id = project_id
        self.dir = os.path.join(_BASE, project_id)
        os.makedirs(self.dir, exist_ok=True)
        self._manifest: Dict[str, Any] = {
            "project_id": project_id,
            "created_at": datetime.utcnow().isoformat(),
            "artifacts": [],
        }

    def path(self, filename: str) -> str:
        return os.path.join(self.dir, filename)

    def write_brief(self, project_name: str, project_brief: str, request: str) -> str:
        """Escribe el brief general del proyecto en Markdown."""
        content = (
            f"# {project_name}\n\n"
            f"## Petición original\n{request}\n\n"
            f"## Brief general (paper compartido)\n{project_brief}\n"
        )
        return self._write("brief.md", content, agent="Boss", role="BRIEF")

    def write_return(self, agent: str, role: str, filename: str, content: str) -> str:
        """Escribe la devolución de un agente (su archivo de trabajo)."""
        return self._write(filename, content or "", agent=agent, role=role)

    def read(self, filename: str) -> str:
        """Lee de vuelta un artefacto (lo que Boss necesita para ensamblar)."""
        p = self.path(filename)
        if not os.path.exists(p):
            return ""
        with open(p, "r", encoding="utf-8") as f:
            return f.read()

    def _write(self, filename: str, content: str, agent: str, role: str) -> str:
        p = self.path(filename)
        with open(p, "w", encoding="utf-8") as f:
            f.write(content)
        self._manifest["artifacts"].append({
            "agent": agent,
            "role": role,
            "file": filename,
            "bytes": len(content.encode("utf-8")),
            "written_at": datetime.utcnow().isoformat(),
        })
        self._flush_manifest()
        return p

    def _flush_manifest(self) -> None:
        with open(self.path("manifest.json"), "w", encoding="utf-8") as f:
            json.dump(self._manifest, f, indent=2, ensure_ascii=False)

    def manifest(self) -> Dict[str, Any]:
        return dict(self._manifest)

    def relative_files(self) -> List[str]:
        """Lista de artefactos (rutas relativas a backend/) para exponer en la UI."""
        return [os.path.join("_workspace", self.project_id, a["file"]) for a in self._manifest["artifacts"]]
