"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

interface SubstitutionModalProps {
  taskName: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: (note: string) => void;
  isSaving?: boolean;
}

export default function SubstitutionModal({
  taskName,
  isOpen,
  onClose,
  onSave,
  isSaving = false,
}: SubstitutionModalProps) {
  const [note, setNote] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    setNote("");
    inputRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isSaving) onCloseRef.current();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isSaving]);

  if (!isOpen) return null;

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedNote = note.trim();
    if (trimmedNote) onSave(trimmedNote);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSaving) onClose();
      }}
    >
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-2xl border border-line bg-panel p-6 shadow-2xl"
        aria-labelledby="swap-title"
      >
        <div className="mb-5 flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">Flexible plan</p>
            <h2 id="swap-title" className="mt-2 text-xl font-semibold text-white">What did you do instead?</h2>
            <p className="mt-1 text-sm text-slate-400">{taskName}</p>
          </div>
          <button type="button" onClick={onClose} disabled={isSaving} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-50" aria-label="Close dialog">
            <X size={18} />
          </button>
        </div>
        <label htmlFor="substitution-note" className="mb-2 block text-sm font-medium text-slate-300">Alternative activity</label>
        <textarea
          id="substitution-note"
          ref={inputRef}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="e.g. Took a 30-minute recovery walk instead of the gym"
          rows={3}
          maxLength={500}
          required
          className="w-full resize-none rounded-xl border border-line bg-slate-950/70 p-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-amber-400"
        />
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" onClick={onClose} disabled={isSaving} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-50">Cancel</button>
          <button type="submit" disabled={isSaving || !note.trim()} className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50">
            {isSaving ? "Saving..." : "Save swap"}
          </button>
        </div>
      </form>
    </div>
  );
}
