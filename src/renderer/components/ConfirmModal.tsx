import { AlertTriangle, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "./ui/button";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "./ui/dialog";

interface ConfirmModalProps {
  pid: number;
  name: string;
  isSystemProcess: boolean;
  count?: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  pid,
  name,
  isSystemProcess,
  count,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelButtonRef.current?.focus();
  }, []);

  return (
    <Dialog open onClose={onCancel}>
      <div className="flex items-start gap-4">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
            isSystemProcess
              ? "bg-amber-500/15 text-amber-400"
              : "bg-destructive/15 text-destructive"
          }`}
        >
          {isSystemProcess ? (
            <AlertTriangle className="h-5 w-5" />
          ) : (
            <X className="h-5 w-5" />
          )}
        </div>
        <div className="flex-1">
          <DialogHeader>
            <DialogTitle>
              {count && count > 1 ? `Kill ${count} Processes` : isSystemProcess ? "System Process Warning" : "Kill Process"}
            </DialogTitle>
            <DialogDescription>
              {count && count > 1 ? (
                <span>Are you sure you want to kill <strong className="text-foreground">{count} processes</strong>?</span>
              ) : isSystemProcess ? (
                <span><strong className="text-amber-400">Warning:</strong> This appears to be a system process. Killing it may cause instability.</span>
              ) : (
                <span>Are you sure you want to kill <strong className="text-foreground">{name}</strong> <span className="text-muted-foreground">(PID {pid})</span>?</span>
              )}
            </DialogDescription>
          </DialogHeader>
        </div>
      </div>
      <DialogFooter className="mt-6">
        <Button ref={cancelButtonRef} variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="destructive" onClick={onConfirm}>
          {count && count > 1 ? "Yes, Kill All" : "Kill Process"}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
