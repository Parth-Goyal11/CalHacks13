"use client";

import { useState, type DragEvent, type ReactNode } from "react";

interface DropZoneProps {
  onFile: (file: File) => void;
  disabled?: boolean;
  children?: ReactNode;
  className?: string;
}

function pickImageFile(list: FileList | DataTransferItemList | null): File | null {
  if (!list) return null;
  if (list instanceof DataTransferItemList) {
    for (const item of list) {
      if (item.kind === "file") {
        const f = item.getAsFile();
        if (f && f.type.startsWith("image/")) return f;
      }
    }
    return null;
  }
  for (const f of list) {
    if (f.type.startsWith("image/")) return f;
  }
  return null;
}

export function DropZone({
  onFile,
  disabled,
  children,
  className = "",
}: DropZoneProps) {
  const [dragging, setDragging] = useState(false);

  function onDragEnter(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    setDragging(true);
  }

  function onDragOver(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    e.dataTransfer.dropEffect = "copy";
    setDragging(true);
  }

  function onDragLeave(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    // Only clear when leaving the zone itself
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setDragging(false);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    if (disabled) return;
    const file =
      pickImageFile(e.dataTransfer.files) ||
      pickImageFile(e.dataTransfer.items);
    if (file) onFile(file);
  }

  return (
    <div
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      data-dragging={dragging ? "true" : "false"}
      className={`transition-[border-color,background-color,box-shadow] duration-200 ${className} ${
        dragging
          ? "border-sky-400/80 bg-sky-500/10 shadow-[inset_0_0_40px_rgba(56,189,248,0.12)]"
          : ""
      }`}
    >
      {children}
    </div>
  );
}
