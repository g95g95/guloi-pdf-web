from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from pypdf import PdfReader, PdfWriter


@dataclass
class FormField:
    name: str
    value: str = ""
    field_type: str = "text"


@dataclass
class FormResult:
    ok: bool
    output_path: Optional[Path] = None
    error: Optional[str] = None


def read_form_fields(source: Path) -> list[FormField]:
    try:
        reader = PdfReader(str(source))
        raw = reader.get_form_text_fields() or {}
        return [FormField(name=k, value=v or "") for k, v in raw.items()]
    except Exception:
        return []


def write_form_fields(source: Path, output: Path, values: dict) -> FormResult:
    try:
        reader = PdfReader(str(source))
        writer = PdfWriter(clone_from=reader)
        writer.update_page_form_field_values(None, values)
        output.parent.mkdir(parents=True, exist_ok=True)
        with open(output, "wb") as fh:
            writer.write(fh)
        return FormResult(ok=True, output_path=output)
    except Exception as e:
        return FormResult(ok=False, error=str(e))
