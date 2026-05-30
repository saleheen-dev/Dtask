import { useEffect, useRef, useState } from "react";

interface KillByPortProps {
  onSubmit: (port: string) => void;
  onCancel: () => void;
}

export function KillByPort({ onSubmit, onCancel }: KillByPortProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") onCancel();
    if (e.key === "Enter" && value.trim()) onSubmit(value.trim());
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="mx-4 w-full max-w-sm rounded-xl border border-gray-700 bg-gray-800 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-white">Kill by port</h3>
        <p className="mt-1 text-sm text-gray-400">
          Enter a port number to find and kill the owning process
        </p>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g. 3000"
          className="mt-4 h-10 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 text-sm text-white placeholder-gray-500 transition-colors focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
        />
        <div className="mt-3 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded-lg border border-gray-600 bg-gray-700 px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-600 hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={() => value.trim() && onSubmit(value.trim())}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-500"
          >
            Kill
          </button>
        </div>
      </div>
    </div>
  );
}
