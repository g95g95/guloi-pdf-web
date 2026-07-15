from dataclasses import dataclass
from pathlib import Path
from typing import Optional
import pikepdf


@dataclass
class SecurityResult:
    ok: bool
    output_path: Optional[Path] = None
    error: Optional[str] = None


def set_password(
    source: Path,
    output: Path,
    user_password: str,
    owner_password: Optional[str] = None,
) -> SecurityResult:
    try:
        output.parent.mkdir(parents=True, exist_ok=True)
        with pikepdf.open(str(source)) as pdf:
            enc = pikepdf.Encryption(
                user=user_password,
                owner=owner_password or user_password,
                R=4,
            )
            pdf.save(str(output), encryption=enc)
        return SecurityResult(ok=True, output_path=output)
    except Exception as e:
        return SecurityResult(ok=False, error=str(e))


def remove_password(source: Path, output: Path, password: str) -> SecurityResult:
    try:
        output.parent.mkdir(parents=True, exist_ok=True)
        with pikepdf.open(str(source), password=password) as pdf:
            pdf.save(str(output))
        return SecurityResult(ok=True, output_path=output)
    except pikepdf.PasswordError:
        return SecurityResult(ok=False, error="Password errata")
    except Exception as e:
        return SecurityResult(ok=False, error=str(e))
