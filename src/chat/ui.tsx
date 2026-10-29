import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Select from "@radix-ui/react-select";
import { Check, ChevronDown, X } from "lucide-react";
import type { Theme } from "./types";
import { Button, cn } from "../design/primitives";
export { Button, cn, BunnyLogo } from "../design/primitives";
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  theme,
  sheet = false,
}: {
  open: boolean;
  onOpenChange(value: boolean): void;
  title: string;
  description: string;
  children: React.ReactNode;
  theme: Theme;
  sheet?: boolean;
}) {
  const returnFocus = React.useRef<HTMLElement | null>(null);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <div className="chat-app chat-portal" data-theme={theme}>
          <Dialog.Overlay className="chat-overlay" />
          <Dialog.Content
            className={cn("chat-dialog", sheet && "chat-sheet")}
            onOpenAutoFocus={() => {
              returnFocus.current = document.activeElement as HTMLElement;
            }}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              if (returnFocus.current?.isConnected) returnFocus.current.focus();
            }}
          >
            <div className="chat-dialog-heading">
              <div>
                <Dialog.Title>{title}</Dialog.Title>
                <Dialog.Description>{description}</Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <Button variant="ghost" size="icon" aria-label="关闭">
                  <X />
                </Button>
              </Dialog.Close>
            </div>
            {children}
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function SelectControl({
  value,
  onChange,
  options,
  label,
  disabled,
}: {
  value: string;
  onChange(value: string): void;
  options: { id: string; name: string }[];
  label: string;
  disabled?: boolean;
}) {
  // No portal: the menu inherits scoped theme and remains inside the containing focus trap.
  return (
    <Select.Root value={value} onValueChange={onChange} disabled={disabled}>
      <Select.Trigger className="chat-select" aria-label={label}>
        <Select.Value />
        <ChevronDown size={14} />
      </Select.Trigger>
      <Select.Content
        position="popper"
        sideOffset={5}
        className="chat-select-menu"
      >
        <Select.Viewport>
          <Select.Group>
            <Select.Label className="chat-select-label">{label}</Select.Label>
            {options.map((option) => (
              <Select.Item
                key={option.id}
                value={option.id}
                className="chat-select-item"
              >
                <Select.ItemText>{option.name}</Select.ItemText>
                <Select.ItemIndicator>
                  <Check size={14} />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Group>
        </Select.Viewport>
      </Select.Content>
    </Select.Root>
  );
}
