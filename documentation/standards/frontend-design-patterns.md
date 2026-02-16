# Frontend Design Patterns and Workflow

Last updated: 2026-02-16

## Goals
- Keep the operator console consistent, accessible, and extensible.
- Ensure coding agents apply the same patterns every time.

## Source-backed standards adopted
1. Centralized theming and color modes (Material UI).
2. System-aware light/dark mode with user override persistence.
3. Accessible color handling and focus behavior.
4. Component composition and state isolation patterns from React docs.
5. Respect reduced motion preferences.

## Implementation rules for this repo
- Theme and tokens belong in `apps/frontend/src/theme.ts`.
- API calls belong in `apps/frontend/src/api.ts`.
- UI components should consume typed data models; avoid inline fetch logic where practical.
- Use semantic MUI controls and preserve keyboard-accessible interactions.
- If animations are used, include `prefers-reduced-motion` fallbacks.

## Card readability standards (light and dark mode)
- Meet WCAG 2.x contrast minimums:
  Text contrast: at least `4.5:1` for normal body text, `3:1` for large text.
  Non-text UI indicators (borders/icons/chips): at least `3:1` against adjacent colors.
- Do not rely on color alone for meaning. Pair status/priority color with text or icon labels.
- Keep compact cards scannable:
  Title first, short description snippet second, metadata row third.
  Clamp long descriptions to a few lines to avoid pushing critical metadata off-card.
- Use icon-plus-label metadata pills for dense spaces; avoid icon-only indicators for critical fields.
- In dark mode, avoid low-contrast grey-on-grey combinations:
  Use a clear luminance step between card surface and text layers (title strongest, metadata secondary).

## Agent implementation checklist for card UI changes
1. Validate contrast targets against WCAG ratios for title, body text, and metadata pills.
2. Verify information hierarchy remains readable at narrow lane widths.
3. Verify dark and light modes independently (do not assume parity).
4. Verify card metadata still exposes priority, dependency count, and tags.

## Relevant references
- Material UI theming and color schemes:
  - https://mui.com/material-ui/customization/theming/
  - https://mui.com/material-ui/customization/dark-mode/
- React component and state patterns:
  - https://react.dev/learn/your-first-component
  - https://react.dev/learn/extracting-state-logic-into-a-reducer
- Accessibility and motion:
  - https://www.w3.org/WAI/WCAG22/quickref/
  - https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
  - https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html
  - https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html
  - https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-contrast
  - https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion
- Compact UI patterns:
  - https://primer.style/product/components/labels/accessibility/
  - https://m1.material.io/components/cards.html
