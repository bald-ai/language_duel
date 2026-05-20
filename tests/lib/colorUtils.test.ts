import { describe, expect, it } from "vitest";
import { deriveNeutralShades } from "@/lib/colorUtils";

function hexChannels(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

describe("deriveNeutralShades", () => {
  it("keeps the light shade achromatic for a gray base", () => {
    // A gray base desaturates to neutralS = 0; without clamping, the light
    // shade's saturation went negative and tinted the gray with an inverted hue.
    const { light } = deriveNeutralShades("#808080");
    const [r, g, b] = hexChannels(light);
    expect(r).toBe(g);
    expect(g).toBe(b);
  });

  it("returns valid 6-digit hex shades", () => {
    const shades = deriveNeutralShades("#3B82F6");
    for (const shade of [shades.DEFAULT, shades.light, shades.dark]) {
      expect(shade).toMatch(/^#[0-9A-F]{6}$/);
    }
  });
});
