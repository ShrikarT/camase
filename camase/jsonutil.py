"""JSON helpers that refuse to emit NaN / Inf."""

from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any


def sanitize(obj: Any) -> Any:
    if isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return None
        return obj
    if hasattr(obj, "item") and not isinstance(obj, (bytes, str)):
        try:
            return sanitize(obj.item())
        except Exception:
            pass
    if isinstance(obj, dict):
        return {str(k): sanitize(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [sanitize(v) for v in obj]
    return obj


def dump(obj: Any, path: str | Path, indent: int = 2) -> Path:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(sanitize(obj), indent=indent))
    return path
