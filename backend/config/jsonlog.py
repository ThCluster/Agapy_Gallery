"""Journalisation en JSON simple (une ligne par événement), lisible par journald, Docker ou un agrégateur."""
import json
import logging
from datetime import datetime, timezone


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        data = {
            "time": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(timespec="milliseconds"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        status = getattr(record, "status_code", None)
        if status is not None:
            data["status"] = status
        request = getattr(record, "request", None)
        path = getattr(request, "path", None)
        if path:
            data["path"] = path  # chemin seul : pas de paramètres de requête (jetons, numéros)
        if record.exc_info:
            data["exc"] = self.formatException(record.exc_info)
        return json.dumps(data, ensure_ascii=False)
