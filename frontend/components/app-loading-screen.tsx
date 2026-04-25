"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/shadcn-utils";

interface AppLoadingScreenProps {
  readonly fadingOut?: boolean;
  readonly message?: string;
  readonly className?: string;
}

export function AppLoadingScreen({
  fadingOut = false,
  message = "Loading Plandera...",
  className,
}: AppLoadingScreenProps) {
  return (
    <div
      className={cn(
        "fixed inset-0 z-[100] flex items-center justify-center bg-background transition-opacity duration-300",
        fadingOut ? "pointer-events-none opacity-0" : "opacity-100",
        className,
      )}
    >
      <div className="flex flex-col items-center gap-4 text-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <div className="space-y-1">
          <div className="text-lg font-semibold text-foreground">Plandera</div>
          <div className="text-sm text-muted-foreground">{message}</div>
        </div>
      </div>
    </div>
  );
}
