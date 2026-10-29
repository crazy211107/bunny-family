import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export const cn = (...values: ClassValue[]) => twMerge(clsx(values));
// shadcn's owned-source composition: CVA variants + Radix Slot. Tokens stay in chat.css.
const buttonVariants = cva(
  "chat-button inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        default: "chat-button-primary",
        outline: "chat-button-outline",
        ghost: "chat-button-ghost",
        danger: "chat-button-danger",
      },
      size: {
        default: "chat-button-default",
        icon: "chat-button-icon",
        sm: "chat-button-sm",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);
export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, ...props }, ref) => {
    const Component = asChild ? Slot : "button";
    return (
      <Component
        ref={ref}
        type="button"
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";
export function BunnyLogo({ small = false }: { small?: boolean }) {
  return (
    <span
      className={cn("chat-logo", small && "chat-logo-small")}
      aria-hidden="true"
    >
      <svg viewBox="0 0 40 40" fill="none">
        <path
          d="M12 20C7 11 9 4 12 5c3 1 5 8 5 12m6 0c0-5 2-13 5-12s4 9 0 15"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M7 26c0-8 5-12 13-12s13 4 13 12c0 6-5 10-13 10S7 32 7 26Z"
          fill="var(--chat-logo-face, #fbfaf3)"
          stroke="currentColor"
          strokeWidth="1.6"
        />
        <circle cx="15" cy="25" r="1.3" fill="currentColor" />
        <circle cx="25" cy="25" r="1.3" fill="currentColor" />
        <path
          d="m18 29 2 1.5 2-1.5"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("product-card", className)} {...props} />;
}
export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "success" | "warning";
  children: React.ReactNode;
}) {
  return (
    <span className={"product-badge product-badge-" + tone}>{children}</span>
  );
}
