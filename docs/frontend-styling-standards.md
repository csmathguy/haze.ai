# Frontend Styling Standards

## Approved Stack

- MUI theme is the source of truth for palette, spacing, typography, shape, and component defaults.
- MUI CSS theme variables are enabled through `cssVariables: true`.
- Use `styled()` for reusable visual primitives.
- Use `sx` for small local adjustments only.
- Use CSS Modules for page layout or larger local stylesheets when plain CSS is clearer than JS styling.

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

- Should this value be a theme token instead of a local literal?
- Is this `sx` block still small enough to stay inline?
- Is the same visual pattern already present elsewhere and ready to be extracted?
- Does this belong in a reusable primitive or theme override instead of a feature component?
- If CSS was added, does it use MUI variables instead of fresh colors?
