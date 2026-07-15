"""Schema tests for the editor annotation JSON contract (app/schemas.py)."""

import json
from pathlib import Path

import pytest

from app.schemas import AnnotationValidationError, parse_annotations, to_dataclasses
from editor.annotations import (
    DrawAnnotation,
    EraseAnnotation,
    FormFieldAnnotation,
    HighlightAnnotation,
    SignatureAnnotation,
    TextAnnotation,
    TextEditAnnotation,
)


def _full_payload():
    return [
        {"kind": "highlight", "page": 0, "rect": [10, 10, 100, 30], "color": [1, 1, 0]},
        {"kind": "draw", "page": 0, "points": [[10, 10], [20, 20], [30, 15]],
         "color": [1, 0, 0], "width": 2.0},
        {"kind": "text", "page": 0, "x": 50, "y": 700, "text": "Ciao",
         "font_size": 12, "color": [0, 0, 0]},
        {"kind": "signature", "page": 0, "x": 100, "y": 100, "width": 120,
         "height": 60, "image_key": "sig-1"},
        {"kind": "erase", "page": 0, "rect": [0, 0, 100, 100],
         "color": [1, 1, 1], "hard": True},
        {"kind": "text_edit", "page": 0, "cover_rect": [50, 700, 300, 740],
         "x": 52, "y": 710, "text": "Nuovo", "font_size": 14, "color": [0, 0, 0]},
        {"kind": "form_field", "page": 0, "field_name": "nome", "value": "Mario"},
    ]


def test_parse_valid_payload_every_kind():
    models = parse_annotations(json.dumps(_full_payload()))
    assert len(models) == 7
    kinds = [m.kind for m in models]
    assert kinds == [
        "highlight", "draw", "text", "signature", "erase", "text_edit", "form_field",
    ]


def test_parse_rejects_invalid_json():
    with pytest.raises(AnnotationValidationError):
        parse_annotations("{not json")


def test_parse_rejects_non_list():
    with pytest.raises(AnnotationValidationError):
        parse_annotations('{"kind": "text"}')


def test_parse_rejects_unknown_kind():
    with pytest.raises(AnnotationValidationError):
        parse_annotations('[{"kind": "sneaky", "page": 0}]')


def test_parse_rejects_out_of_range_color():
    payload = [{"kind": "highlight", "page": 0, "rect": [0, 0, 1, 1], "color": [2, 0, 0]}]
    with pytest.raises(AnnotationValidationError):
        parse_annotations(json.dumps(payload))


def test_parse_rejects_negative_page():
    payload = [{"kind": "text", "page": -1, "x": 0, "y": 0, "text": "x"}]
    with pytest.raises(AnnotationValidationError):
        parse_annotations(json.dumps(payload))


def test_parse_rejects_too_many_annotations():
    payload = [{"kind": "form_field", "page": 0, "field_name": "a", "value": "b"}] * 501
    with pytest.raises(AnnotationValidationError):
        parse_annotations(json.dumps(payload))


def test_parse_accepts_500_annotations():
    payload = [{"kind": "form_field", "page": 0, "field_name": "a", "value": "b"}] * 500
    assert len(parse_annotations(json.dumps(payload))) == 500


def test_parse_rejects_text_too_long():
    payload = [{"kind": "text", "page": 0, "x": 0, "y": 0, "text": "x" * 5001}]
    with pytest.raises(AnnotationValidationError):
        parse_annotations(json.dumps(payload))


def test_parse_rejects_form_value_too_long():
    payload = [{"kind": "form_field", "page": 0, "field_name": "a", "value": "v" * 1001}]
    with pytest.raises(AnnotationValidationError):
        parse_annotations(json.dumps(payload))


def test_parse_rejects_bad_image_key():
    payload = [{"kind": "signature", "page": 0, "x": 0, "y": 0, "width": 10,
                "height": 10, "image_key": "../evil"}]
    with pytest.raises(AnnotationValidationError):
        parse_annotations(json.dumps(payload))


def test_to_dataclasses_full_roundtrip(tmp_path):
    sig_path = tmp_path / "sig_000.img"
    sig_path.write_bytes(b"fake")
    models = parse_annotations(json.dumps(_full_payload()))
    anns = to_dataclasses(models, {"sig-1": sig_path})
    assert [type(a) for a in anns] == [
        HighlightAnnotation, DrawAnnotation, TextAnnotation, SignatureAnnotation,
        EraseAnnotation, TextEditAnnotation, FormFieldAnnotation,
    ]
    hl = anns[0]
    assert hl.page == 0
    assert hl.rect == (10.0, 10.0, 100.0, 30.0)
    assert hl.color == (1.0, 1.0, 0.0)
    draw = anns[1]
    assert draw.points == [(10.0, 10.0), (20.0, 20.0), (30.0, 15.0)]
    sig = anns[3]
    assert sig.image_path == str(sig_path)
    erase = anns[4]
    assert erase.hard is True
    te = anns[5]
    assert te.cover_rect == (50.0, 700.0, 300.0, 740.0)
    ff = anns[6]
    assert ff.field_name == "nome" and ff.value == "Mario"


def test_to_dataclasses_missing_signature_key(tmp_path):
    models = parse_annotations(json.dumps([
        {"kind": "signature", "page": 0, "x": 0, "y": 0, "width": 10,
         "height": 10, "image_key": "assente"},
    ]))
    with pytest.raises(AnnotationValidationError):
        to_dataclasses(models, {})
