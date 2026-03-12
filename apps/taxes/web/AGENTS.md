# Web Instructions

- Optimize for reviewability, exact values, and accessible correction workflows.
- Prefer Material UI theme tokens and component variants over one-off styling.
- Use `styled()` or reusable UI primitives before copying `sx` blocks.
- Use `sx` only for short local adjustments.
- Do not use inline `style` props unless the value is truly runtime-computed.
- Do not hard-code colors outside `apps/taxes/web/src/theme/`.
- Do not import backend implementation code directly.
- Do not use effects for calculations that can happen during render.
- Keep private file access and extraction logic out of frontend code.
