from dataclasses import dataclass, field
from typing import Tuple

from editor.document_state import Annotation, Command, DocumentState


@dataclass
class HighlightAnnotation(Annotation):
    rect: Tuple[float, float, float, float] = (0.0, 0.0, 0.0, 0.0)
    color: Tuple[float, float, float] = (1.0, 1.0, 0.0)
    kind: str = field(default="highlight", init=False)


@dataclass
class DrawAnnotation(Annotation):
    points: list = field(default_factory=list)
    color: Tuple[float, float, float] = (1.0, 0.0, 0.0)
    width: float = 2.0
    kind: str = field(default="draw", init=False)


@dataclass
class TextAnnotation(Annotation):
    x: float = 0.0
    y: float = 0.0
    text: str = ""
    font_size: float = 12.0
    color: Tuple[float, float, float] = (0.0, 0.0, 0.0)
    kind: str = field(default="text", init=False)


@dataclass
class SignatureAnnotation(Annotation):
    x: float = 0.0
    y: float = 0.0
    width: float = 0.0
    height: float = 0.0
    image_path: str = ""
    kind: str = field(default="signature", init=False)


@dataclass
class EraseAnnotation(Annotation):
    rect: Tuple[float, float, float, float] = (0.0, 0.0, 0.0, 0.0)
    color: Tuple[float, float, float] = (1.0, 1.0, 1.0)
    hard: bool = False
    kind: str = field(default="erase", init=False)


@dataclass
class TextEditAnnotation(Annotation):
    """Modifica testo PDF: copre cover_rect con bianco, scrive nuovo testo a (x, y)."""
    cover_rect: Tuple[float, float, float, float] = (0.0, 0.0, 0.0, 0.0)
    x: float = 0.0
    y: float = 0.0
    text: str = ""
    font_size: float = 12.0
    color: Tuple[float, float, float] = (0.0, 0.0, 0.0)
    kind: str = field(default="text_edit", init=False)


@dataclass
class FormFieldAnnotation(Annotation):
    """Valorizzazione campo modulo AcroForm — scritto al save via writer.update_page_form_field_values."""
    field_name: str = ""
    value: str = ""
    kind: str = field(default="form_field", init=False)


class AddAnnotationCommand(Command):
    def __init__(self, state: DocumentState, annotation: Annotation):
        self.state = state
        self.annotation = annotation

    def do(self):
        if self.annotation not in self.state.annotations:
            self.state.annotations.append(self.annotation)

    def undo(self):
        if self.annotation in self.state.annotations:
            self.state.annotations.remove(self.annotation)
