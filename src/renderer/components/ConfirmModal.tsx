import { AlertTriangle, X } from "lucide-react";
import { useEffect, useRef } from "react";

interface ConfirmModalProps {
  pid: number;
  name: string;
  isSystemProcess: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  pid,
  name,
  isSystemProcess,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelButtonRef.current?.focus();
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
    >
      <div
        className="mx-4 w-full max-w-md rounded-xl border border-gray-700 bg-gray-800 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
              isSystemProcess
                ? "bg-amber-500/15 text-amber-400"
                : "bg-red-500/15 text-red-400"
            }`}
          >
            {isSystemProcess ? (
              <AlertTriangle className="h-5 w-5" />
            ) : (
              <X className="h-5 w-5" />
            )}
          </div>
          <div className="flex-1">
            <h3 id="confirm-title" className="text-lg font-semibold text-white">
              {isSystemProcess ? "System Process Warning" : "Kill Process"}
            </h3>
            {isSystemProcess ? (
              <p className="mt-2 text-sm leading-relaxed text-amber-300/90">
                <span className="font-semibold text-amber-400">Warning:</span>{" "}
                This appears to be a system process. Killing it may cause
                instability.
              </p>
            ) : null}
            <p className="mt-2 text-sm text-gray-300">
              Are you sure you want to kill{" "}
              <span className="font-semibold text-white">{name}</span>{" "}
              <span className="text-gray-400">(PID {pid})</span>?
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            ref={cancelButtonRef}
            onClick={onCancel}
            className="rounded-lg border border-gray-600 bg-gray-700 px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-600 hover:text-white focus:outline-none focus:ring-2 focus:ring-gray-500"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            Kill Process
          </button>
        </div>
      </div>
    </div>
  );
}
