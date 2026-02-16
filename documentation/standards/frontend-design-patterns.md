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

## Relevant references
- Material UI theming and color schemes:
  - https://mui.com/material-ui/customization/theming/
  - https://mui.com/material-ui/customization/dark-mode/
- React component and state patterns:
  - https://react.dev/learn/your-first-component
  - https://react.dev/learn/extracting-state-logic-into-a-reducer
- Accessibility and motion:
  - https://www.w3.org/WAI/WCAG22/quickref/
  - https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion
