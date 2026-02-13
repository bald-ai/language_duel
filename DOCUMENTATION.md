---
tags:
  - design-system
  - theme
  - colors
  - typography
  - buttons
  - backgrounds
  - status-colors
  - preferences
  - providers
  - clerk
source: "Design Rules.backup.md"
migrated_on: "2026-01-25"
---

# Language-Duel Design System

## Single Source of Truth

**To change the theme, edit `lib/theme.ts`** - all components import colors from there.

The theme system uses a **simplified 3-color palette** approach:
- **bg**: Background base color
- **primary**: Main brand color for buttons and UI elements
- **accent**: Call-to-action color for highlights and emphasis

All other color variants (light, dark, etc.) are **automatically derived** from these three base colors using `lib/colorUtils.ts`.

For pure CSS needs (animations, patterns), CSS variables are defined in `app/globals.css`. The ThemeProvider applies the active theme to CSS variables at runtime; keep the default `:root` values aligned with the first palette to avoid initial paint mismatch.

---

## File Structure

```
lib/colorUtils.ts     <- Color shade derivation utility
lib/theme.ts          <- MAIN THEME FILE (palettes & color exports)
app/globals.css       <- CSS variables (for animations/patterns, sync with theme.ts)
app/layout.tsx        <- Font definitions & Clerk styling (Exceptions)
app/components/ThemeProvider.tsx    <- Runtime theme switching & persistence
app/components/BackgroundProvider.tsx  <- Background image selection
DOCUMENTATION.md      <- This documentation
```

---

## Color Palettes

The theme system includes **5 pre-defined color palettes**. Each palette consists of 3 base colors:

| Palette Name | Background | Primary | Accent | Mood |
|-------------|------------|---------|--------|------|
| **Playful Duo** | `#FFF8F1` | `#FB7185` | `#22C55E` | Warm cream with rose & green |
| **Toybox Adventure** | `#FDF4FF` | `#A855F7` | `#FACC15` | Soft purple & sunny yellow |
| **Warm Mischief** | `#FFF7ED` | `#F97316` | `#0EA5E9` | Peach with orange & sky blue |
| **Friendly Rivalry** | `#F0F9FF` | `#2563EB` | `#FB7185` | Light blue with deep blue & rose |
| **Candy Co-op** | `#FFF1F2` | `#EC4899` | `#22D3EE` | Blush pink & cyan |

### Automatic Shade Derivation

From each palette's 3 base colors, the system automatically generates:

| Derived Role | Source | Description |
|--------------|--------|-------------|
| **primary** shades | `primary` | DEFAULT, light, dark, darkest, glow |
| **cta** shades | `accent` | DEFAULT, light, lighter, dark, darkest, glow |
| **neutral** shades | `accent` (desaturated) | Decorative, muted elements |
| **secondary** shades | `primary` (hue-shifted) | Supporting elements |
| **background** shades | `bg` | DEFAULT, elevated |
| **text** shades | `bg` (contrast-based) | DEFAULT, muted, inverse |

---

## Background Images

Users can select from **2 background images**:

| Filename | Label | Description |
|----------|-------|-------------|
| `background.jpg` | Castle Lights | Default background |
| `background_2.jpg` | Mystic Forest | Alternative background |

Background selection is managed by `BackgroundProvider` and persisted to Convex for authenticated users.

---

## Status Colors

Status colors are **consistent across all palettes** for accessibility:

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

| Variant | Color Source | Use For |
|---------|--------------|---------|
| `primary` (default) | Palette's `primary` | Most buttons, standard actions |
| `cta` | Palette's `accent` | Highlighted actions, primary goals |

---

## How to Change the Color Set

### Adding a New Palette

Edit `lib/theme.ts` and add to the `colorPalettes` array:

```typescript
export const colorPalettes: ColorPalette[] = [
  // ... existing palettes
  {
    name: "my-new-palette",
    label: "My New Palette",
    bg: "#0B0A14",      // Background base
    primary: "#3C34C5", // Primary base
    accent: "#DE7321",  // Accent/CTA base
  },
];
```

That's it! All shades are automatically derived.

### Syncing CSS Variables (first palette only)

If you change the first palette's values, update `:root` in `app/globals.css`:

```css
:root {
  --color-primary: #3C34C5;  /* <- Keep in sync with first palette */
  /* ... */
}
```

### Valid Color Set Names

Update `convex/userPreferences.ts` to include new palette names:

```typescript
const VALID_COLOR_SETS = [
  "playful-duo",
  "toybox-adventure",
  // ... add new palette names
] as const;
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

## User Preferences & Persistence

### Storage Strategy

| User State | Color Set Storage | Background Storage |
|------------|-------------------|-------------------|
| Authenticated | Convex database | Convex database |
| Unauthenticated | localStorage | localStorage |

Preferences are synced on login - Convex data takes priority over localStorage.

### Providers

```tsx
// app/layout.tsx - Provider nesting order
<ThemeProvider>
  <BackgroundProvider>
    {children}
  </BackgroundProvider>
</ThemeProvider>
```

---

## Exceptions & Third-Party Tools

### Clerk Authentication

Clerk's styling (colors for login/signup modals) is handled separately in `app/layout.tsx` within the `<ClerkProvider>` appearance prop.

This is intentionally kept separate from the main theme system as it is a third-party configuration that rarely needs iteration compared to the main UI.

---

## Customization Philosophy

### Single-Place Configuration

The design system is built around the principle that **all visual changes should happen in one place**:

1. **Change palette?** -> Edit `lib/theme.ts`
2. **Add background?** -> Add image to `/public`, update `BackgroundSelector.tsx` and `convex/userPreferences.ts`
3. **Change fonts?** -> Edit `app/layout.tsx`

Components automatically adapt to color set changes - no manual updates needed.

### Key Design Principles

#### 1. Visual Hierarchy Through Contrast

Most elements should use the primary color. Only the MOST important action gets the accent/CTA color.

```
Bad:  5 buttons, 4 different colors -> confusing
Good: 5 buttons, 4 primary + 1 accent -> clear hierarchy
```

#### 2. Semantic Color Usage

Colors have meaning:
- **Primary** = "This is a normal action"
- **CTA/Accent** = "This is THE action I want you to take"
- **Neutral** = "This is decorative/secondary information"

#### 3. Consistency

Use the theme system! Don't hardcode hex values in components.

```tsx
// Bad - hardcoded color
<div style={{ backgroundColor: "#3C34C5" }}>

// Good - uses theme
import { colors } from "@/lib/theme";
<div style={{ backgroundColor: colors.primary.DEFAULT }}>
```

#### 4. Automatic Adaptation

Components using the `colors` object automatically update when the user switches palettes. No re-renders or prop changes needed - the mutable color object is updated in place.

---

## Backend Cleanup Notes

- Scheduled duels are auto-cleaned every 5 minutes via `convex/crons.ts` -> `internal.scheduledDuels.autoCleanupScheduledDuels`.
- The same scheduled cleanup pass also dismisses stale `duel_challenge` notifications and cancels unresolved pending challenges after 60 minutes.
- Pending friend requests are auto-rejected once older than 7 days and related notifications are dismissed (daily cron).
- Weekly goals are auto-cleaned daily:
  - `active` goals expire by `expiresAt`.
  - `editing` goals expire 7 days after `createdAt`.
  - related weekly plan notifications are dismissed.
