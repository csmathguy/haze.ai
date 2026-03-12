# Frontend React And TypeScript Guidance

## Defaults

- Use React with modern function components and TypeScript in strict mode.
- Prefer Vite for local development and fast feedback loops.
- Use Material UI as the primary component and icon library to reduce bespoke UI surface area.
- Start with MUI X Charts for dashboards so theming and interaction stay consistent with MUI.

## React Practices

- Keep render logic pure and derived from props, state, and loader results.
- Do not add effects for calculations that can happen during render.
- Use effects only for synchronization with systems outside React.
- Keep state close to where it is used. Lift it only when multiple branches truly need shared ownership.
- Separate feature components from reusable primitives.

## TypeScript Practices

- Enable `strict`.
- Prefer `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, and project references when the workspace is scaffolded.
- Model tax concepts with explicit types and discriminated unions instead of stringly typed objects.
- Prefer schema-backed parsing at the API boundary, then work with trusted typed domain objects internally.

## UI Composition

- Organize the web app by feature, not by file type alone.
- Keep route-level components thin. Push business decisions into feature hooks or services.
- Use MUI theme tokens and component variants instead of ad hoc inline styling.
- Favor composition and small focused components over deep inheritance or giant container components.

## Styling System

- Treat each product web app's `apps/<product>/web/src/theme/` directory as the source of truth for palette, typography, shape, and component defaults.
- Keep reusable visual primitives in `styled()` wrappers or theme overrides before repeating `sx` blocks.
- Use `sx` for local adjustments only; do not let it become a hidden stylesheet.
- Use CSS Modules for page layout or larger local CSS where class-based styling is clearer.
- Do not use inline `style` except for truly runtime-computed values.
- Do not hard-code colors outside the theme layer.

## UX For Tax Workflows

- Optimize for reviewability over novelty. Dense, accurate, easy-to-scan screens matter more than decorative motion.
- Make confidence, provenance, and validation state visible next to extracted values.
- Preserve manual override paths wherever extraction can be wrong.
- Design tables, forms, and summaries for side-by-side comparison with source documents.

## Charting Guidance

- Use charts only when they help explain category totals, trends, or discrepancies.
- Every chart should have a matching tabular or textual fallback.
- Do not hide exact tax-relevant values behind hover-only interactions.
