"use client";

import { useMemo, useState } from "react";

const HEX_RE = /^#([0-9a-fA-F]{6})$/;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function hexToRgb(hex: string) {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return null;
  const int = parseInt(m[1], 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return { r, g, b };
}

function rgbToHex(r: number, g: number, b: number) {
  const to2 = (v: number) => v.toString(16).padStart(2, "0");
  return `#${to2(clamp(Math.round(r), 0, 255))}${to2(clamp(Math.round(g), 0, 255))}${to2(
    clamp(Math.round(b), 0, 255)
  )}`;
}

// Mix base color toward white by amount (0..1)
function mixWithWhite(hex: string, amount: number) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const a = clamp(amount, 0, 1);
  return rgbToHex(
    rgb.r + (255 - rgb.r) * a,
    rgb.g + (255 - rgb.g) * a,
    rgb.b + (255 - rgb.b) * a
  );
}

const KEY_ORDER = [
  ["q", "w", "e", "r", "t"],
  ["a", "s", "d", "f", "g"],
  ["z", "x", "c", "v", "b"],
] as const;

// Hand-picked base palette (roughly matching the screenshot vibe)
const BASE_COLORS: Record<string, string> = {
  q: "#2b2f36", // dark gray
  w: "#000000", // black
  e: "#cfd3d6", // light gray
  r: "#ffffff", // white
  t: "#b89a8f", // beige
  a: "#2cb4b8", // teal
  s: "#339af0", // blue
  d: "#8b5cf6", // purple
  f: "#d946ef", // magenta
  g: "#ff6bd6", // pink
  z: "#40c057", // green
  x: "#2f9e89", // teal-green
  c: "#b26a00", // brown/orange
  v: "#ff922b", // orange
  b: "#ff7a7a", // salmon
};

function shadeFromBase(baseHex: string, shade: 1 | 2 | 3 | 4 | 5) {
  // 1 = darkest, 5 = lightest (mix toward white)
  const mix = { 1: 0.0, 2: 0.18, 3: 0.33, 4: 0.5, 5: 0.67 }[shade];
  return mixWithWhite(baseHex, mix);
}

export function isValidHexColor(value: string) {
  return HEX_RE.test(value);
}

type Props = {
  label: string;
  value: string | undefined;
  onChange: (hex: string | undefined) => void;
  allowClear?: boolean;
  compact?: boolean;
};

export default function ThemeColorPicker({
  label,
  value,
  onChange,
  allowClear = true,
  compact = false,
}: Props) {
  const initialBase = useMemo(() => {
    if (value && isValidHexColor(value)) return value.toLowerCase();
    return "#339af0";
  }, [value]);

  const [selectedBase, setSelectedBase] = useState<string>(initialBase);
  const [selectedShade, setSelectedShade] = useState<1 | 2 | 3 | 4 | 5>(5);
  const [hexInput, setHexInput] = useState<string>(value ?? shadeFromBase(selectedBase, selectedShade));
  const [error, setError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  const displayedHex = useMemo(() => {
    const v = (value ?? "").trim().toLowerCase();
    if (!isDirty && v && isValidHexColor(v)) return v;
    return hexInput.trim().toLowerCase();
  }, [hexInput, isDirty, value]);

  const previewHex = useMemo(() => {
    const v = displayedHex;
    if (isValidHexColor(v)) return v;
    return shadeFromBase(selectedBase, selectedShade);
  }, [displayedHex, selectedBase, selectedShade]);

  const pickBase = (hex: string) => {
    setSelectedBase(hex);
    const next = shadeFromBase(hex, selectedShade);
    setHexInput(next);
    setIsDirty(false);
    setError(null);
    onChange(next);
  };

  const pickShade = (shade: 1 | 2 | 3 | 4 | 5) => {
    setSelectedShade(shade);
    const next = shadeFromBase(selectedBase, shade);
    setHexInput(next);
    setIsDirty(false);
    setError(null);
    onChange(next);
  };

  return (
    <div className={`rounded-2xl border-2 border-gray-300 bg-white ${compact ? "p-3" : "p-4"}`}>
      <div className={`flex items-center justify-between gap-3 ${compact ? "mb-2" : "mb-3"}`}>
        <div className={`${compact ? "text-sm" : "text-sm"} font-bold text-gray-800`}>{label}</div>
        <div className="flex items-center gap-2">
          <div
            className={`${compact ? "h-6 w-6" : "h-7 w-7"} rounded-lg border-2 border-gray-300`}
            style={{ backgroundColor: value ?? previewHex }}
            title={value ?? previewHex}
          />
          {allowClear && (
            <button
              type="button"
              onClick={() => {
                setIsDirty(false);
                onChange(undefined);
              }}
              className={`rounded-lg border-2 border-gray-300 bg-gray-50 ${
                compact ? "px-2 py-1 text-[11px]" : "px-2 py-1 text-xs"
              } font-bold text-gray-700 hover:bg-gray-100`}
              title="Clear"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Palette */}
      <div className={`${compact ? "mb-3" : "mb-4"} space-y-2`}>
        {KEY_ORDER.map((row) => (
          <div key={row.join("")} className="grid grid-cols-5 gap-2">
            {row.map((key) => {
              const hex = BASE_COLORS[key];
              const isSelected = selectedBase.toLowerCase() === hex.toLowerCase();
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => pickBase(hex)}
                  className={`relative ${compact ? "h-9" : "h-11"} rounded-xl border-2 font-bold uppercase ${
                    isSelected ? "border-blue-500" : "border-gray-200"
                  }`}
                  style={{ backgroundColor: hex }}
                  title={hex}
                >
                  <span
                    className={compact ? "text-xs" : "text-sm"}
                    style={{
                      color: key === "r" || key === "e" ? "#111827" : "#ffffff",
                      textShadow: key === "r" || key === "e" ? "none" : "0 1px 1px rgba(0,0,0,0.35)",
                    }}
                  >
                    {key}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Shades */}
      <div className={compact ? "mb-3" : "mb-4"}>
        <div className="mb-2 text-sm font-bold text-gray-800">Shades</div>
        <div className="grid grid-cols-5 gap-2">
          {([1, 2, 3, 4, 5] as const).map((shade) => {
            const hex = shadeFromBase(selectedBase, shade);
            const isSelected = selectedShade === shade;
            return (
              <button
                key={shade}
                type="button"
                onClick={() => pickShade(shade)}
                className={`${compact ? "h-10 text-xs" : "h-12 text-sm"} rounded-xl border-2 font-bold ${
                  isSelected ? "border-blue-500" : "border-gray-200"
                }`}
                style={{ backgroundColor: hex, color: shade >= 4 ? "#0b1220" : "#ffffff" }}
                title={hex}
              >
                ⇧{shade}
              </button>
            );
          })}
        </div>
      </div>

      {/* Hex input */}
      <div>
        <div className="mb-2 text-sm font-bold text-gray-800">Hex code</div>
        <div className="flex items-center gap-2">
          <div className="rounded-xl border-2 border-gray-200 bg-gray-50 px-3 py-2 font-mono text-sm text-gray-700">
            #
          </div>
          <input
            value={(displayedHex || "#").replace(/^#/, "")}
            onChange={(e) => {
              setIsDirty(true);
              const next = `#${e.target.value.replace(/[^0-9a-fA-F]/g, "").slice(0, 6)}`;
              setHexInput(next);
              if (isValidHexColor(next)) {
                setError(null);
                onChange(next.toLowerCase());
              } else {
                setError(next.length === 7 ? "Invalid hex" : null);
              }
            }}
            onBlur={() => {
              setIsDirty(false);
              const v = hexInput.trim();
              if (!v) return;
              if (isValidHexColor(v)) {
                setError(null);
                onChange(v.toLowerCase());
              } else {
                setError("Hex must look like #1971c2");
              }
            }}
            className={`flex-1 rounded-xl border-2 border-gray-300 bg-white px-3 py-2 font-mono ${
              compact ? "text-xs" : "text-sm"
            } text-gray-800 focus:border-gray-500 focus:outline-none`}
            placeholder="1971c2"
            inputMode="text"
            autoComplete="off"
            spellCheck={false}
          />
          <div
            className={`${compact ? "h-9 w-9" : "h-10 w-10"} rounded-xl border-2 border-gray-300`}
            style={{ backgroundColor: previewHex }}
          />
        </div>
        {error && <div className="mt-2 text-xs font-semibold text-red-600">{error}</div>}
      </div>
    </div>
  );
}

