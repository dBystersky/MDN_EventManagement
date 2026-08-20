<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# UI: shadcn/ui is mandatory

This repo has **five contributors**. All user-facing UI must look the same. **Do not invent a new visual language.**

## Required

- Use **shadcn/ui** components for every interactive or chrome element: buttons, inputs, labels, selects, textareas, cards, tables, dialogs, sheets, dropdowns, tabs, badges, alerts, toasts, navigation, forms.
- Import from `@/components/ui/*` (the shadcn primitives in this project).
- If a needed primitive is missing, **add it with the shadcn CLI** (`npx shadcn@latest add <component>`), then use it. Do not hand-roll a parallel Button/Input/Card.
- Reuse existing layout patterns (spacing, typography, page shells) from pages that already use shadcn. Match them.

## Forbidden (UI drift)

- One-off styled `<button>`, `<input>`, `<select>`, `<table>` with custom Tailwind as a design system
- New color palettes, gradients, or “dashboard themes” per feature (no Roy-dark vs Nick-light vs resource-blue unless that theme is already the shared shadcn theme)
- Copy-pasting unrelated CSS / component libraries (MUI, Chakra, raw HTML forms “just for a demo”)

Demos and test pages follow the same rules as product pages.

## Allowed without shadcn

- Semantic layout: `<main>`, `<section>`, `<form>` wrappers
- Tiny presentational markup that is not a control (e.g. a page `<h1>`) using the **existing** Tailwind/shadcn theme tokens only

When in doubt, **use shadcn**. Visual consistency beats a custom-looking widget.
