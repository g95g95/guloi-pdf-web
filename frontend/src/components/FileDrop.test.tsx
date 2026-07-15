import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FileDrop } from "./FileDrop";

function pdf(name: string, sizeBytes = 1024): File {
  const file = new File(["%PDF-1.4"], name, { type: "application/pdf" });
  Object.defineProperty(file, "size", { value: sizeBytes });
  return file;
}

function txt(name: string, sizeBytes = 1024): File {
  const file = new File(["hello"], name, { type: "text/plain" });
  Object.defineProperty(file, "size", { value: sizeBytes });
  return file;
}

/** Controlled harness so onChange updates the rendered value. */
function Harness(props: {
  multiple?: boolean;
  maxFiles?: number;
  maxSizeMB?: number;
  initial?: File[];
  disabled?: boolean;
  onChangeSpy?: (files: File[]) => void;
}) {
  const [files, setFiles] = useState<File[]>(props.initial ?? []);
  return (
    <FileDrop
      value={files}
      onChange={(next) => {
        props.onChangeSpy?.(next);
        setFiles(next);
      }}
      {...(props.disabled !== undefined ? { disabled: props.disabled } : {})}
      {...(props.multiple !== undefined ? { multiple: props.multiple } : {})}
      {...(props.maxFiles !== undefined ? { maxFiles: props.maxFiles } : {})}
      {...(props.maxSizeMB !== undefined ? { maxSizeMB: props.maxSizeMB } : {})}
    />
  );
}

function fileInput(): HTMLInputElement {
  // The hidden <input type=file> is the only file input in the tree.
  return document.querySelector('input[type="file"]') as HTMLInputElement;
}

describe("FileDrop", () => {
  it("renders a drop zone with button semantics and accepts PDF", () => {
    render(<Harness />);
    const zone = screen.getByRole("button", { name: /trascina|seleziona|file/i });
    expect(zone).toBeInTheDocument();
    expect(fileInput()).toHaveAttribute("accept", "application/pdf,.pdf");
  });

  it("opens the file picker when the zone is clicked", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const clickSpy = vi.spyOn(fileInput(), "click");
    await user.click(screen.getByRole("button", { name: /trascina|seleziona|file/i }));
    expect(clickSpy).toHaveBeenCalled();
  });

  it("opens the file picker on Enter and Space", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const clickSpy = vi.spyOn(fileInput(), "click");
    const zone = screen.getByRole("button", { name: /trascina|seleziona|file/i });
    zone.focus();
    clickSpy.mockClear();
    await user.keyboard("{Enter}");
    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockClear();
    await user.keyboard(" ");
    expect(clickSpy).toHaveBeenCalled();
  });

  it("accepts a valid PDF via input change and lists it", () => {
    render(<Harness />);
    fireEvent.change(fileInput(), { target: { files: [pdf("doc.pdf")] } });
    expect(screen.getByText("doc.pdf")).toBeInTheDocument();
  });

  it("rejects a non-PDF file with a visible error", () => {
    render(<Harness />);
    fireEvent.change(fileInput(), { target: { files: [txt("notes.txt")] } });
    expect(screen.queryByText("notes.txt")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/notes\.txt/i);
    expect(screen.getByRole("alert")).toHaveTextContent(/pdf/i);
  });

  it("rejects an oversized file with a visible error mentioning the limit", () => {
    render(<Harness maxSizeMB={50} />);
    fireEvent.change(fileInput(), {
      target: { files: [pdf("big.pdf", 60 * 1024 * 1024)] },
    });
    expect(screen.queryByText("big.pdf")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/50 MB/i);
  });

  it("respects maxFiles, keeping the allowed ones and rejecting the rest", () => {
    render(<Harness multiple maxFiles={2} />);
    fireEvent.change(fileInput(), {
      target: { files: [pdf("a.pdf"), pdf("b.pdf"), pdf("c.pdf")] },
    });
    expect(screen.getByText("a.pdf")).toBeInTheDocument();
    expect(screen.getByText("b.pdf")).toBeInTheDocument();
    expect(screen.queryByText("c.pdf")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("removes a file when its remove button is clicked", async () => {
    const user = userEvent.setup();
    render(<Harness multiple initial={[pdf("keep.pdf"), pdf("drop.pdf")]} />);
    const dropRow = screen.getByText("drop.pdf").closest("li") as HTMLElement;
    await user.click(within(dropRow).getByRole("button", { name: /rimuovi/i }));
    expect(screen.queryByText("drop.pdf")).not.toBeInTheDocument();
    expect(screen.getByText("keep.pdf")).toBeInTheDocument();
  });

  it("reorders files with the up button", async () => {
    const user = userEvent.setup();
    render(<Harness multiple initial={[pdf("first.pdf"), pdf("second.pdf")]} />);
    const secondRow = screen.getByText("second.pdf").closest("li") as HTMLElement;
    await user.click(within(secondRow).getByRole("button", { name: /su/i }));
    const names = screen.getAllByRole("listitem").map((li) => within(li).getByText(/\.pdf/).textContent);
    expect(names).toEqual(["second.pdf", "first.pdf"]);
  });

  it("toggles a drag-over state on dragenter and clears on dragleave", () => {
    render(<Harness />);
    const zone = screen.getByRole("button", { name: /trascina|seleziona|file/i });
    fireEvent.dragEnter(zone);
    expect(zone).toHaveAttribute("data-dragover", "true");
    fireEvent.dragLeave(zone);
    expect(zone).toHaveAttribute("data-dragover", "false");
  });

  it("accepts files dropped onto the zone", () => {
    render(<Harness />);
    const zone = screen.getByRole("button", { name: /trascina|seleziona|file/i });
    fireEvent.drop(zone, { dataTransfer: { files: [pdf("dropped.pdf")] } });
    expect(screen.getByText("dropped.pdf")).toBeInTheDocument();
  });

  it("reorders files with the down button", async () => {
    const user = userEvent.setup();
    render(<Harness multiple initial={[pdf("first.pdf"), pdf("second.pdf")]} />);
    const firstRow = screen.getByText("first.pdf").closest("li") as HTMLElement;
    await user.click(within(firstRow).getByRole("button", { name: /giù/i }));
    const names = screen
      .getAllByRole("listitem")
      .map((li) => within(li).getByText(/\.pdf/).textContent);
    expect(names).toEqual(["second.pdf", "first.pdf"]);
  });

  it("when disabled, blocks picker, keyboard, drop and keeps the input out of the tab order", () => {
    const onChangeSpy = vi.fn();
    render(<Harness disabled onChangeSpy={onChangeSpy} />);
    const zone = screen.getByRole("button", { name: /trascina|seleziona|file/i });
    const clickSpy = vi.spyOn(fileInput(), "click");

    fireEvent.click(zone);
    fireEvent.keyDown(zone, { key: "Enter" });
    fireEvent.keyDown(zone, { key: " " });
    expect(clickSpy).not.toHaveBeenCalled();

    fireEvent.drop(zone, { dataTransfer: { files: [pdf("blocked.pdf")] } });
    expect(onChangeSpy).not.toHaveBeenCalled();
    expect(screen.queryByText("blocked.pdf")).not.toBeInTheDocument();

    expect(zone).toHaveAttribute("tabindex", "-1");
    expect(fileInput()).toHaveAttribute("tabindex", "-1");
  });

  it("keeps the hidden input out of the tab order even when enabled", () => {
    render(<Harness />);
    expect(fileInput()).toHaveAttribute("tabindex", "-1");
  });
});
