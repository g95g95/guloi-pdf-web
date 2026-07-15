"""JSON schema for editor annotations (web contract for /api/editor/save).

The wire format is a JSON array of objects discriminated by "kind", mirroring
the desktop dataclasses in editor/annotations.py one-to-one:

  highlight:  {kind, page, rect: [x0,y0,x1,y1], color: [r,g,b]}
  draw:       {kind, page, points: [[x,y],...], color, width}
  text:       {kind, page, x, y, text, font_size, color}
  signature:  {kind, page, x, y, width, height, image_key}
  erase:      {kind, page, rect, color, hard}
  text_edit:  {kind, page, cover_rect, x, y, text, font_size, color}
  form_field: {kind, page, field_name, value}

Coordinates are PDF-native points (origin bottom-left, y grows upward) —
identical to the desktop annotation semantics; no conversion happens here.
Colors are [r,g,b] floats in 0..1. `page` is 0-based.

The only deviation from the dataclasses: signature carries `image_key`
(an identifier matching [a-zA-Z0-9_-]{1,64}) instead of `image_path`; the
key references a signature image uploaded alongside the PDF and is resolved
server-side to a tempdir path by to_dataclasses().
"""

import json
from pathlib import Path
from typing import Annotated, Literal, Union

from pydantic import BaseModel, ConfigDict, Field, TypeAdapter, ValidationError

from editor.annotations import (
    DrawAnnotation,
    EraseAnnotation,
    FormFieldAnnotation,
    HighlightAnnotation,
    SignatureAnnotation,
    TextAnnotation,
    TextEditAnnotation,
)

MAX_ANNOTATIONS = 500
MAX_TEXT_LEN = 5000
MAX_FIELD_VALUE_LEN = 1000
MAX_DRAW_POINTS = 10000
IMAGE_KEY_PATTERN = r"^[a-zA-Z0-9_-]{1,64}$"

Coord = Annotated[float, Field(allow_inf_nan=False)]
ColorComponent = Annotated[float, Field(ge=0.0, le=1.0)]
Color = tuple[ColorComponent, ColorComponent, ColorComponent]
Rect = tuple[Coord, Coord, Coord, Coord]
Point = tuple[Coord, Coord]
FontSize = Annotated[float, Field(gt=0.0, le=500.0)]


class AnnotationValidationError(ValueError):
    """Raised for any invalid annotations payload (maps to a fixed 422)."""


class _Base(BaseModel):
    model_config = ConfigDict(extra="forbid")
    page: int = Field(ge=0)


class HighlightModel(_Base):
    kind: Literal["highlight"]
    rect: Rect
    color: Color = (1.0, 1.0, 0.0)


class DrawModel(_Base):
    kind: Literal["draw"]
    points: list[Point] = Field(min_length=2, max_length=MAX_DRAW_POINTS)
    color: Color = (1.0, 0.0, 0.0)
    width: Annotated[float, Field(gt=0.0, le=100.0)] = 2.0


class TextModel(_Base):
    kind: Literal["text"]
    x: Coord
    y: Coord
    text: str = Field(min_length=1, max_length=MAX_TEXT_LEN)
    font_size: FontSize = 12.0
    color: Color = (0.0, 0.0, 0.0)


class SignatureModel(_Base):
    kind: Literal["signature"]
    x: Coord
    y: Coord
    width: Annotated[float, Field(gt=0.0, allow_inf_nan=False)]
    height: Annotated[float, Field(gt=0.0, allow_inf_nan=False)]
    image_key: str = Field(pattern=IMAGE_KEY_PATTERN)


class EraseModel(_Base):
    kind: Literal["erase"]
    rect: Rect
    color: Color = (1.0, 1.0, 1.0)
    hard: bool = False


class TextEditModel(_Base):
    kind: Literal["text_edit"]
    cover_rect: Rect
    x: Coord
    y: Coord
    text: str = Field(max_length=MAX_TEXT_LEN)
    font_size: FontSize = 12.0
    color: Color = (0.0, 0.0, 0.0)


class FormFieldModel(_Base):
    kind: Literal["form_field"]
    field_name: str = Field(min_length=1, max_length=255)
    value: str = Field(max_length=MAX_FIELD_VALUE_LEN)


AnnotationModel = Annotated[
    Union[
        HighlightModel,
        DrawModel,
        TextModel,
        SignatureModel,
        EraseModel,
        TextEditModel,
        FormFieldModel,
    ],
    Field(discriminator="kind"),
]

_payload_adapter = TypeAdapter(
    Annotated[list[AnnotationModel], Field(max_length=MAX_ANNOTATIONS)]
)


def parse_annotations(raw: str) -> list:
    """Parse+validate the annotations JSON string. Any problem (malformed JSON,
    unknown kind, out-of-range value, too many items) raises
    AnnotationValidationError — no user data in the exception message."""
    try:
        payload = json.loads(raw)
    except (json.JSONDecodeError, UnicodeDecodeError, TypeError):
        raise AnnotationValidationError("invalid json") from None
    try:
        return _payload_adapter.validate_python(payload)
    except ValidationError:
        raise AnnotationValidationError("invalid annotations") from None


def to_dataclasses(models: list, signature_paths: dict[str, Path]) -> list:
    """Convert validated models to the desktop editor dataclasses.

    Signature image_key is resolved through signature_paths (key -> tempdir
    path of the uploaded image); a missing key raises AnnotationValidationError.
    """
    result = []
    for m in models:
        if isinstance(m, HighlightModel):
            result.append(HighlightAnnotation(page=m.page, rect=m.rect, color=m.color))
        elif isinstance(m, DrawModel):
            result.append(DrawAnnotation(
                page=m.page, points=list(m.points), color=m.color, width=m.width,
            ))
        elif isinstance(m, TextModel):
            result.append(TextAnnotation(
                page=m.page, x=m.x, y=m.y, text=m.text,
                font_size=m.font_size, color=m.color,
            ))
        elif isinstance(m, SignatureModel):
            path = signature_paths.get(m.image_key)
            if path is None:
                raise AnnotationValidationError("unknown signature key")
            result.append(SignatureAnnotation(
                page=m.page, x=m.x, y=m.y, width=m.width, height=m.height,
                image_path=str(path),
            ))
        elif isinstance(m, EraseModel):
            result.append(EraseAnnotation(
                page=m.page, rect=m.rect, color=m.color, hard=m.hard,
            ))
        elif isinstance(m, TextEditModel):
            result.append(TextEditAnnotation(
                page=m.page, cover_rect=m.cover_rect, x=m.x, y=m.y,
                text=m.text, font_size=m.font_size, color=m.color,
            ))
        elif isinstance(m, FormFieldModel):
            result.append(FormFieldAnnotation(
                page=m.page, field_name=m.field_name, value=m.value,
            ))
        else:  # pragma: no cover - unreachable with a validated payload
            raise AnnotationValidationError("unknown annotation model")
    return result
