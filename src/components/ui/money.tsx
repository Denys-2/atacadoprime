import { useSyncExternalStore, useState, useCallback } from "react";
import { Eye, EyeOff } from "lucide-react";
import { brl } from "@/lib/format";

// ---------- Global "hide all money" store (persisted) ----------
const KEY = "money-hidden-global";
const listeners = new Set<() => void>();
let hidden = typeof window !== "undefined" && window.localStorage.getItem(KEY) === "1";

function setHidden(v: boolean) {
  hidden = v;
  try { window.localStorage.setItem(KEY, v ? "1" : "0"); } catch { /* ignore */ }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

export function useMoneyHidden(): [boolean, (v: boolean) => void, () => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => hidden,
    () => false,
  );
  const toggle = useCallback(() => setHidden(!hidden), []);
  return [value, setHidden, toggle];
}

// ---------- <Money /> component with per-instance reveal ----------
type MoneyProps = {
  value: number | null | undefined;
  className?: string;
  style?: React.CSSProperties;
  iconClassName?: string;
  /** Se true, força mostrar sempre (sem olhinho). */
  alwaysVisible?: boolean;
};

export function Money({ value, className, style, iconClassName, alwaysVisible }: MoneyProps) {
  const [globalHidden, , toggleGlobal] = useMoneyHidden();
  const [localReveal, setLocalReveal] = useState(false);
  const shouldHide = !alwaysVisible && globalHidden && !localReveal;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    // Se global está oculto, revela só este; se global está visível, oculta tudo.
    if (globalHidden) setLocalReveal((v) => !v);
    else toggleGlobal();
  };

  return (
    <span className={className} style={style}>
      <span
        aria-hidden={shouldHide}
        style={{
          filter: shouldHide ? "blur(8px)" : undefined,
          transition: "filter 150ms ease",
          userSelect: shouldHide ? "none" : undefined,
        }}
      >
        {brl(value)}
      </span>
      {!alwaysVisible && (
        <button
          type="button"
          onClick={handleClick}
          className={`ml-1.5 inline-flex align-middle opacity-60 hover:opacity-100 transition ${iconClassName ?? ""}`}
          aria-label={shouldHide ? "Mostrar valor" : "Ocultar valor"}
          title={shouldHide ? "Mostrar valor" : "Ocultar valor"}
        >
          {shouldHide
            ? <Eye className="h-3.5 w-3.5" />
            : <EyeOff className="h-3.5 w-3.5" />}
        </button>
      )}
    </span>
  );
}

// ---------- Master toggle for headers ----------
export function MoneyMasterToggle({ className, style }: { className?: string; style?: React.CSSProperties }) {
  const [isHidden, , toggle] = useMoneyHidden();
  return (
    <button
      type="button"
      onClick={toggle}
      className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-full border text-xs font-semibold transition hover:-translate-y-0.5 ${className ?? ""}`}
      style={style}
      aria-label={isHidden ? "Mostrar valores" : "Ocultar valores"}
      title={isHidden ? "Mostrar valores" : "Ocultar valores"}
    >
      {isHidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
      {isHidden ? "Mostrar $" : "Ocultar $"}
    </button>
  );
}
