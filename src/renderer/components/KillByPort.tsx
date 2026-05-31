import { useEffect, useRef, useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "./ui/dialog";

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
    <Dialog open onClose={onCancel}>
      <DialogHeader>
        <DialogTitle>Kill by port</DialogTitle>
        <DialogDescription>
          Enter a port number to find and kill the owning process
        </DialogDescription>
      </DialogHeader>
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="e.g. 3000"
        className="mt-4"
      />
      <DialogFooter className="mt-4">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="destructive" onClick={() => value.trim() && onSubmit(value.trim())}>
          Kill
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
