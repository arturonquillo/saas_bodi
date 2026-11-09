"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { COPY } from "../copy";
import { useColorMode } from "./ColorModeProvider";
import type { ColorMode } from "./color-mode";

function ModeIcon({ mode }: { mode: ColorMode }) {
  if (mode === "dark") return <Moon className="size-4" strokeWidth={1.75} />;
  if (mode === "system") return <Monitor className="size-4" strokeWidth={1.75} />;
  return <Sun className="size-4" strokeWidth={1.75} />;
}

export function ColorModeToggle() {
  const { mode, setMode } = useColorMode();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label={COPY.color_mode}
        >
          <ModeIcon mode={mode} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        <DropdownMenuLabel>{COPY.color_mode}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={mode} onValueChange={(value) => setMode(value as ColorMode)}>
          <DropdownMenuRadioItem value="light">
            <Sun className="size-4" strokeWidth={1.75} />
            {COPY.color_mode_light}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <Moon className="size-4" strokeWidth={1.75} />
            {COPY.color_mode_dark}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">
            <Monitor className="size-4" strokeWidth={1.75} />
            {COPY.color_mode_system}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
