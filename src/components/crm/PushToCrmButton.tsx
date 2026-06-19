import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { PushToCrmDialog, type PushToCrmDialogProps } from "./PushToCrmDialog";

type Props = Omit<PushToCrmDialogProps, "open" | "onOpenChange"> & {
  label?: string;
  size?: ButtonProps["size"];
  variant?: ButtonProps["variant"];
  className?: string;
};

export function PushToCrmButton({ label = "Push to CRM", size = "sm", variant = "outline", className, ...dialogProps }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size={size} variant={variant} onClick={() => setOpen(true)} className={className}>
        <Sparkles className="h-3.5 w-3.5 mr-1.5" />
        {label}
      </Button>
      <PushToCrmDialog open={open} onOpenChange={setOpen} navigateOnSuccess {...dialogProps} />
    </>
  );
}
