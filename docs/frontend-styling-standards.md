# Frontend Styling Standards

Reviewed on March 13, 2026.

## Scope

- Audience: agents and humans editing `apps/*/web`
- Goal: keep every app readable, customizable, and visually consistent without sacrificing accessibility
- Sources: WCAG 2.2 Understanding docs and official Material UI theming and palette guidance

## Approved Stack

- MUI theme is the source of truth for palette, spacing, typography, shape, and component defaults.
- MUI CSS theme variables stay enabled through `cssVariables: true`.
- Use `styled()` for reusable visual primitives.
- Use `sx` for small local adjustments only.
- Use CSS Modules for page layout or larger local stylesheets when plain CSS is clearer than JS styling.

## Design System Layers

1. Foundation tokens
   - raw product colors, typography families, radius, spacing, and motion values
2. Semantic roles
   - app-facing roles such as `surface`, `border`, `focus`, `text`, `accent`, and `signal`
3. Component defaults
   - MUI overrides, variants, and reusable primitives
4. Screen-level composition
   - local layout and hierarchy choices built from the theme, not from fresh literals

Use semantic roles in product code. Keep raw color values inside `apps/<product>/web/src/theme/`.

## Contrast Policy

- Body text and images of text must meet at least `4.5:1` contrast against the background.
- Large text may use `3:1`, but only when it is actually large enough under WCAG guidance.
- Meaningful non-text visuals such as borders, icons, selection indicators, charts, and focus rings must meet at least `3:1` against adjacent colors.
- Do not round borderline values up. A value below the threshold still fails.
- Treat the WCAG minimum as a floor, not a target. Thin fonts, translucent overlays, gradients, and muted text should exceed the minimum.
- Do not rely on generated contrast tokens blindly. Material UI documents that `contrastThreshold` can produce counterproductive results, so important combinations still need direct verification.

## Color Usage Rules

- Color must not be the only visual means of conveying information, action, or state.
- Selected, focused, warning, and success states must use more than hue alone.
  Examples: border change, icon, label, underline, weight, shape, or explicit text.
- Links and interactive controls must stay identifiable even when a user cannot distinguish the chosen hues.
- Avoid using low-opacity text over gradients or imagery for important content.

## Focus And Interaction Rules

- Keep browser focus visible by default unless you replace it with a stronger authored indicator.
- Internal standard: use a focus indicator at least equivalent to a `2px` perimeter with at least `3:1` change or adjacent contrast.
- Prefer `outline` and `outline-offset` or an equally visible alternative over subtle glow-only treatments.
- Hover, selected, and pressed states should remain understandable without requiring pointer precision or color discrimination.

## Theme Framework

- Keep `createTheme()` as the single assembly point for each app theme.
- Use standard palette roles for `primary`, `secondary`, `error`, `warning`, `info`, and `success`.
- Add custom semantic tokens through theme augmentation when the app needs roles such as:
  - `surface.raised`
  - `surface.sunken`
  - `border.subtle`
  - `border.strong`
  - `focus.ring`
  - `review.selected`
- If custom colors are introduced, provide all important tokens explicitly or generate them with `augmentColor()` from a verified `main` value.
- Prefer `theme.vars` and generated channel tokens for translucent surfaces instead of hard-coded rgba literals.
- When supporting light and dark modes, prefer MUI `colorSchemes` over ad hoc `theme.palette.mode` branching.
- If a product adds light and dark schemes, define which mode is the default and how user preference is stored before building screen-level styling.

## Customization Contract

- Shared cross-app rules:
  - neutral surface progression stays calm and readable
  - danger, warning, success, and info roles keep consistent meaning
  - focus treatment stays visible across all apps
  - body text contrast stays at or above policy
- Product-specific customization is allowed for:
  - accent family
  - display typography
  - hero treatments and decorative gradients
  - product-only semantic roles
- Product-specific customization is not allowed to:
  - weaken required contrast
  - remove non-color state cues
  - hard-code fresh colors in feature components
  - bypass the theme with repeated one-off `sx` color declarations

## Decision Tree

- Theme token or component override:
  Use when the value or behavior belongs to the design system.
- `styled()` wrapper:
  Use when a visual pattern is reused across multiple components.
- `sx`:
  Use when the style is local, short, and unlikely to be reused.
- CSS Module:
  Use when layout or structured CSS reads more clearly as CSS than as nested JS objects.
- Inline `style`:
  Exception only for truly runtime-computed values such as drag coordinates or measured transforms.

## Guardrails

- Do not use inline `style={{ ... }}` in frontend components.
- Do not hard-code color literals outside the owning web app's `apps/<product>/web/src/theme/`.
- Keep `sx` blocks small. If a block grows past a handful of top-level properties, extract it.
- Import theme concerns through the public theme entrypoint instead of internal token files.
- Keep shared visual primitives in reusable components before repeating style patterns.

## CSS Module Rules

- Prefer MUI CSS variables such as `var(--mui-palette-background-paper)` over raw color literals.
- Avoid `!important`.
- Keep selector and nesting depth low so modules stay local and readable.

## Review Checklist

- Does text contrast meet the `4.5:1` or `3:1` rule appropriate for the text size?
- Do borders, icons, and focus indicators meet the `3:1` non-text contrast rule?
- Does the design communicate state without relying on color alone?
- Should this value be a theme token instead of a local literal?
- Is this `sx` block still small enough to stay inline?
- Is the same visual pattern already present elsewhere and ready to be extracted?
- Does this belong in a reusable primitive or theme override instead of a feature component?
- If CSS was added, does it use MUI variables instead of fresh colors?
