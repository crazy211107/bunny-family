import React, { useEffect, useRef } from "react";
import {
  Archive,
  FileImage,
  Grid2X2,
  Highlighter,
  Paintbrush,
  Redo2,
  Search,
  Spline,
  Undo2,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  Award,
  Bell,
  BookOpen,
  Camera,
  Carrot,
  ChartNoAxesCombined,
  Check,
  Clapperboard,
  Download,
  Droplets,
  Film,
  Heart,
  Image,
  ImagePlus,
  Images,
  NotebookPen,
  PanelsTopLeft,
  Pause,
  Pencil,
  Play,
  Plus,
  Rabbit,
  RotateCcw,
  Save,
  SlidersHorizontal,
  Sparkles,
  Sprout,
  Star,
  Sticker,
  Sun,
  Trash2,
  Type,
  UserRoundPlus,
  UsersRound,
  Video,
  WandSparkles,
  X,
} from "lucide-react";
const Icons = {
  Archive,
  FileImage,
  Grid2X2,
  Highlighter,
  Paintbrush,
  Redo2,
  Search,
  Spline,
  Undo2,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  Award,
  Bell,
  BookOpen,
  Camera,
  Carrot,
  ChartNoAxesCombined,
  Check,
  Clapperboard,
  Download,
  Droplets,
  Film,
  Heart,
  Image,
  ImagePlus,
  Images,
  NotebookPen,
  PanelsTopLeft,
  Pause,
  Pencil,
  Play,
  Plus,
  Rabbit,
  RotateCcw,
  Save,
  SlidersHorizontal,
  Sparkles,
  Sprout,
  Star,
  Sticker,
  Sun,
  Trash2,
  Type,
  UserRoundPlus,
  UsersRound,
  Video,
  WandSparkles,
  X,
};
export function Icon({ name, size = 20, ...props }) {
  const C = Icons[name] || Icons.Sparkles;
  return <C size={size} strokeWidth={1.6} aria-hidden="true" {...props} />;
}
export function Bunny({ size = 44, ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 72"
      fill="none"
      aria-hidden="true"
      {...props}
    >
      <path
        d="M19 31C7-4 27-6 29 27C32-8 52-1 43 32C62 44 59 67 32 67C5 68 0 43 19 31Z"
        fill="var(--paper,#fff9f0)"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        d="M21 18L24 29M39 17L37 29"
        stroke="#e6a5b9"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <circle cx="23" cy="46" r="1.8" fill="currentColor" />
      <circle cx="41" cy="46" r="1.8" fill="currentColor" />
      <path
        d="M29 51L32 53L35 51M32 53V56"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <ellipse cx="17" cy="51" rx="4" ry="2.3" fill="#ffd9e8" />
      <ellipse cx="47" cy="51" rx="4" ry="2.3" fill="#ffd9e8" />
    </svg>
  );
}
export function Button({
  children,
  icon,
  variant = "",
  className = "",
  ...props
}) {
  return (
    <button className={`button ${variant} ${className}`} {...props}>
      {icon && <Icon name={icon} />}
      <span>{children}</span>
    </button>
  );
}
export function PageTitle({ title, subtitle, children }) {
  return (
    <div className="page-title">
      <div>
        <h1>
          {title}
          <span className="title-heart">♡</span>
        </h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
export function Drawer({ title, onClose, children, wide = false }) {
  const root = useRef(null);
  useEffect(() => {
    const before = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const el = root.current;
    el?.querySelector("button,input,select,textarea")?.focus();
    const key = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
      if (e.key === "Tab") {
        const focusable = [
          ...el.querySelectorAll("button,input,select,textarea,a[href]"),
        ].filter((x) => !x.disabled && x.getClientRects().length);
        const first = focusable[0],
          last = focusable.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    el.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = overflow;
      el.removeEventListener("keydown", key);
      before?.focus?.();
    };
  }, []);
  return (
    <div
      className="drawer-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        ref={root}
        className={`drawer ${wide ? "wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="drawer-header">
          <div>
            <span className="handwritten">把小日子，好好收起来</span>
            <h2>{title}</h2>
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="关闭抽屉"
          >
            <Icon name="X" />
          </button>
        </header>
        <div className="drawer-body">{children}</div>
      </section>
    </div>
  );
}
export function Empty({ text, children }) {
  return (
    <div className="empty">
      <Bunny size={55} />
      <p>{text}</p>
      {children}
    </div>
  );
}
