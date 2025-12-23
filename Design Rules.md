# Language-Duel Design System

## 🎯 Single Source of Truth

**To change the theme, edit `lib/theme.ts`** - all components import colors from there.

For pure CSS needs (animations, patterns), CSS variables are defined in `app/globals.css`. The ThemeProvider applies the active theme to CSS variables at runtime; keep the default `:root` values aligned with the `default` theme to avoid initial paint mismatch.

---

## File Structure

```
lib/theme.ts          ← MAIN THEME FILE (TypeScript, used by components)
app/globals.css       ← CSS variables (for animations/patterns, sync with theme.ts)
app/layout.tsx        ← Font definitions & Clerk styling (Exceptions)
lib/Design Rules.md   ← This documentation
```

---

## Color Palette

| Role | Color | Hex | When to Use |
|------|-------|-----|-------------|
| **Primary** | Royal Blue | `#3C34C5` | Standard buttons, active states, brand elements |
| **CTA** | Burnt Orange | `#DE7321` | Important actions, highlights, notifications |
| **Neutral** | Olive Gold | `#B3A57A` | Decorative elements, muted text, borders |
| **Secondary** | Steel Blue | `#397AAC` | Supporting elements, hover states |

## Status Colors

Use these for feedback states (errors, warnings, success). Defined in `lib/theme.ts` under `colors.status`.

| Role | Hex | Use For |
|------|-----|---------|
| **Success** | `#3BB273` | Confirmations, positive feedback |
| **Warning** | `#E3B341` | Cautions, validation warnings |
| **Danger** | `#E35F5F` | Destructive actions, errors |

---

## Button Variants

### Usage in Code

```tsx
import { MenuButton } from "@/app/components/MenuButton";

// Standard button (primary color)
<MenuButton onClick={handleClick}>Study</MenuButton>

// CTA button (highlighted action)
<MenuButton onClick={handleClick} variant="cta">Duel</MenuButton>
```

### When to Use Each

| Variant | Color | Use For |
|---------|-------|---------|
| `primary` (default) | Royal Blue | Most buttons, standard actions |
| `cta` | Burnt Orange | Highlighted actions, primary goals |

---

## How to Change the Theme

### Step 1: Edit `lib/theme.ts`

```typescript
export const colors = {
  primary: {
    DEFAULT: "#3C34C5",  // ← Change these
    light: "#4F47D8",
    dark: "#2A248F",
    // ...
  },
  // ...
}
```

### Step 2: Sync CSS Variables (default theme only)

If you change the `default` theme values, update the `:root` CSS variables in `app/globals.css` so the first paint matches before ThemeProvider runs:

```css
:root {
  --color-primary: #3C34C5;  /* ← Keep in sync with theme.ts */
  /* ... */
}
```

---

## Typography

Fonts are defined in `app/layout.tsx`:

| Font | CSS Variable | Use For |
|------|--------------|---------|
| Bebas Neue | `--font-display` | Headlines, titles |
| Outfit | `--font-outfit` | Body text, UI elements |

To change fonts, edit `app/layout.tsx` and update the imports.

---

## 💡 Exceptions & Third-Party Tools

### Clerk Authentication
Clerk's styling (colors for login/signup modals) is handled separately in `app/layout.tsx` within the `<ClerkProvider>` appearance prop.

This is intentionally kept separate from the main theme system as it is a third-party configuration that rarely needs iteration compared to the main UI.

---

## Key Design Principles

### 1. Visual Hierarchy Through Contrast
Most elements should use the primary color. Only the MOST important action gets the CTA color.

```
Bad:  5 buttons, 4 different colors → confusing
Good: 5 buttons, 4 blue + 1 orange → clear hierarchy
```

### 2. Semantic Color Usage
Colors have meaning:
- **Primary** = "This is a normal action"
- **CTA** = "This is THE action I want you to take"
- **Neutral** = "This is decorative/secondary information"

### 3. Consistency
Use the theme system! Don't hardcode hex values in components.

```tsx
// ❌ Bad - hardcoded color
<div style={{ backgroundColor: "#3C34C5" }}>

// ✅ Good - uses theme
import { colors } from "@/lib/theme";
<div style={{ backgroundColor: colors.primary.DEFAULT }}>
```
