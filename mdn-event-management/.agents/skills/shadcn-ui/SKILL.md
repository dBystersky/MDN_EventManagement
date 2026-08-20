---
name: shadcn-ui
description: >-
  Mandatory shadcn/ui usage for all user-facing UI in MDN Event Management.
  Use when adding or changing pages, forms, buttons, inputs, tables, dialogs,
  navigation, demo UIs, or any React/TSX markup. Prevents visual drift across
  the five-person team.
---

# shadcn/ui (required)

This app is built by multiple people. **Every UI change must use shadcn/ui** so screens look like one product.

## Do this

1. Prefer components already in `components/ui/`.
2. If the primitive does not exist, add it:

```bash
npx shadcn@latest add button input label select textarea card table dialog sheet dropdown-menu badge alert
```

(Only add what you need.)

3. Compose pages from those primitives. Use the project's existing theme (Tailwind v4 + shadcn), not a new palette.

## Do not do this

- Custom-styled native `<button>` / `<input>` / `<select>` as the design
- A new look per feature (dark dashboard vs light admin vs colored test page)
- MUI, Chakra, Ant Design, or ad-hoc CSS component kits
- Skipping shadcn “because it's just a demo”

## Layout only

`<main>`, `<section>`, `<form>`, and headings may stay as HTML if they only wrap shadcn controls and use existing theme classes.
