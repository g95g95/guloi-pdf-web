import pytest
import pikepdf
from core.security import set_password, remove_password, SecurityResult


def test_set_password_produces_encrypted_pdf(tmp_path, tiny_pdf):
    src = tiny_pdf("src.pdf", pages=2)
    out = tmp_path / "locked.pdf"
    result = set_password(src, out, user_password="secret123")
    assert result.ok is True
    with pytest.raises(pikepdf.PasswordError):
        pikepdf.open(str(out))
    with pikepdf.open(str(out), password="secret123") as pdf:
        assert len(pdf.pages) == 2


def test_remove_password_unlocks(tmp_path, tiny_pdf):
    src = tiny_pdf("src.pdf", pages=2)
    locked = tmp_path / "locked.pdf"
    unlocked = tmp_path / "unlocked.pdf"
    set_password(src, locked, user_password="pwd")
    result = remove_password(locked, unlocked, password="pwd")
    assert result.ok is True
    with pikepdf.open(str(unlocked)) as pdf:
        assert len(pdf.pages) == 2


def test_remove_password_wrong_password(tmp_path, tiny_pdf):
    src = tiny_pdf("src.pdf", pages=1)
    locked = tmp_path / "locked.pdf"
    unlocked = tmp_path / "unlocked.pdf"
    set_password(src, locked, user_password="right")
    result = remove_password(locked, unlocked, password="wrong")
    assert result.ok is False
    assert "password" in result.error.lower()
