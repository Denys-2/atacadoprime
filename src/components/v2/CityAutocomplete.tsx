import { useMemo, useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { useCitySuggestions, type CityOption } from "@/hooks/use-city-suggestions";
import { V2 } from "@/components/v2/theme";
import { MapPin } from "lucide-react";

type Props = {
  value: string;
  onChange: (cidade: string, estado?: string | null) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  style?: React.CSSProperties;
  withIcon?: boolean;
  autoFocus?: boolean;
};

/** City input that suggests previously-used cities and auto-fills UF on select. */
export function CityAutocomplete({
  value, onChange, placeholder = "Cidade",
  className = "", inputClassName = "", style, withIcon = false, autoFocus,
}: Props) {
  const { data: options = [] } = useCitySuggestions();
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const q = value.trim().toUpperCase();
  const filtered = useMemo<CityOption[]>(() => {
    if (!q) return options.slice(0, 8);
    return options
      .filter((o) => o.cidade.includes(q))
      .slice(0, 8);
  }, [options, q]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      {withIcon && (
        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" style={{ color: V2.LIGHT_MUTED }} />
      )}
      <Input
        value={value}
        onChange={(e) => { onChange(e.target.value.toUpperCase()); setOpen(true); }}
        onFocus={() => { setFocused(true); setOpen(true); }}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        className={`uppercase ${withIcon ? "pl-10" : ""} ${inputClassName}`}
        style={style}
        autoFocus={autoFocus}
        autoComplete="off"
      />
      {open && focused && filtered.length > 0 && (
        <div
          className="absolute z-50 mt-1 w-full rounded-lg border shadow-lg max-h-60 overflow-auto"
          style={{ background: V2.LIGHT_SURFACE, borderColor: V2.LIGHT_BORDER }}
        >
          {filtered.map((o) => (
            <button
              key={`${o.cidade}-${o.estado ?? ""}`}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(o.cidade, o.estado);
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-sm hover:opacity-80 flex items-center justify-between"
              style={{ color: V2.LIGHT_TEXT }}
            >
              <span>{o.cidade}</span>
              {o.estado && <span className="text-xs opacity-60">{o.estado}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
