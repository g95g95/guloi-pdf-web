from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional


class Command:
    """Interfaccia Command. Sottoclassi implementano do() e undo()."""
    def do(self):
        raise NotImplementedError
    def undo(self):
        raise NotImplementedError


@dataclass
class Annotation:
    """Annotazione astratta. Sottoclassi concrete in editor/annotations.py."""
    page: int = 0
    kind: str = "base"


@dataclass
class DocumentState:
    source: Optional[Path] = None
    annotations: list = field(default_factory=list)
    _undo_stack: list = field(default_factory=list)
    _redo_stack: list = field(default_factory=list)
    _saved_annotation_count: int = 0

    def execute(self, cmd: Command):
        cmd.do()
        self._undo_stack.append(cmd)
        self._redo_stack.clear()

    def undo(self):
        if not self._undo_stack:
            return
        cmd = self._undo_stack.pop()
        cmd.undo()
        self._redo_stack.append(cmd)

    def redo(self):
        if not self._redo_stack:
            return
        cmd = self._redo_stack.pop()
        cmd.do()
        self._undo_stack.append(cmd)

    def can_undo(self) -> bool:
        return bool(self._undo_stack)

    def can_redo(self) -> bool:
        return bool(self._redo_stack)

    def is_dirty(self) -> bool:
        return len(self.annotations) != self._saved_annotation_count or self.can_undo()

    def mark_saved(self):
        self._saved_annotation_count = len(self.annotations)
        self._undo_stack.clear()
        self._redo_stack.clear()
