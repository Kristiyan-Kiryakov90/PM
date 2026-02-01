---
name: modern-web-design
description: Use when the user wants very intuitive, modern web UI/UX design, especially for dashboards, landing pages, and app screens with rich components (cards, carousels, accordions, popovers, tooltips, combo boxes/selects, switches, toasts, tabs, modals, tables, empty states, skeletons). Focus on clarity, hierarchy, accessibility, and production-ready HTML/CSS/JS (often Bootstrap-first unless the repo suggests otherwise).
---

# Modern Web Design Skill

Design and implement UI that feels modern, intuitive, and calm under real usage.

## When To Use

Use this skill when the user asks for:
- Modernizing the UI or making it feel “clean”, “intuitive”, or “professional”.
- Component-rich pages: cards, carousels, accordions, popovers, tooltips, combo boxes/selects, switches, toasts, tabs, modals, tables.
- Better UX states: loading, empty, error, success, disabled.
- Dashboard and landing page polish.

## Defaults And Constraints

- Prefer the existing stack and repo conventions. Do not introduce new frameworks unless asked.
- If Bootstrap is present, use Bootstrap components and utilities first.
- Preserve product intent and user flows; improve clarity before adding novelty.
- Accessibility is required: labels, focus states, keyboard flow, aria attributes where relevant.

## Design Heuristics (High-Impact)

1) Make the primary action obvious.
- Exactly one primary button per region.
- Reduce competing emphasis.

2) Use consistent hierarchy.
- Clear page title + short subtitle.
- Group related actions into cards/sections.

3) Design all states, not just the happy path.
- loading, empty, error, success, disabled.

4) Reduce cognitive load.
- Prefer progressive disclosure (accordions, tabs, modals) over long walls of controls.
- Use helpful defaults and placeholders.

5) Use spacing as structure.
- Favor generous vertical rhythm.
- Align controls to shared edges.

## Visual System (Practical Defaults)

- Type scale (good starting point):
- Page title: ~32px, section title: ~20–24px, body: ~16px, meta: ~12–14px.

- Spacing scale (pick one and stick to it): 4, 8, 12, 16, 24, 32, 48.

- Radii:
- Containers/cards: 12–16px.
- Inputs/buttons: 10–12px.

- Elevation:
- Use subtle shadows and borders together. Avoid heavy shadows.

- Color:
- One primary brand color + neutral grays.
- Use color sparingly for meaning (status, warnings, success).

## Component Playbook

Implement components in this priority order:

1) Structure components
- Navbar/header, page container, section headers, cards, tables/list groups.

2) Interaction components
- Buttons, inputs, selects/combo boxes, switches, tabs, modals.

3) Progressive disclosure
- Accordions for dense details, popovers/tooltips for hints.

4) Feedback components
- Toasts for transient success/info, alerts for blocking issues, skeletons/spinners for loading.

### Component-Specific Guidance

Cards
- Title + short description + clear action row.
- Keep actions aligned and predictable.

Carousels
- Use sparingly. Prefer for marketing/landing highlights.
- Ensure manual controls and avoid rapid auto-advance.

Accordions
- Use to hide advanced/secondary details.
- Default only 0–1 sections open.

Popovers & Tooltips
- Tooltips: short hints only.
- Popovers: richer help or mini-actions.
- Never hide critical actions inside a tooltip/popover alone.

Combo boxes / Selects
- Always include a label.
- Provide an explicit “All” / “None” when relevant.
- For long lists, add search/filter if feasible.

Switches
- Use for immediate boolean toggles.
- Pair with short, specific labels (“Email notifications”).

Toast notifications
- Use for transient confirmations (“Task saved”).
- Auto-dismiss, but allow manual close.
- Do not use toasts for critical errors.

Tables
- Favor readable density: adequate row height, muted meta text.
- Keep the rightmost column for row actions.

Empty states
- Say what this area is, why it’s empty, and what to do next.
- Provide a single primary CTA.

Loading states
- Prefer skeletons for list/table/card regions.
- Use spinners for small/local operations.

## Delivery Workflow (Do This)

When asked to design or modernize a page:

1) Inspect the existing page and shared styles.
- Reuse existing layout wrappers and utility classes.

2) Define the page structure first.
- Title, subtitle, primary action, 2–4 sections.

3) Implement structure components.
- Header, cards/sections, lists/tables.

4) Implement interactions.
- Forms, controls, modals, menus, toggles.

5) Add states and feedback.
- Loading, empty, error, success, disabled.
- Toasts and alerts as appropriate.

6) Polish last.
- Spacing, alignment, consistent button sizing, icon usage, and focus states.

## Implementation Notes (Bootstrap-First)

If Bootstrap is available:
- Use Bootstrap components for: cards, accordion, carousel, tooltip, popover, toast, modal, tabs, form controls, switches.
- Use utilities for spacing/layout: container, row/col, gap, d-flex, align-items-center, justify-content-between, mb-*, mt-*, p-*.
- Add small custom CSS only where Bootstrap cannot express the intent.

## Quality Bar Checklist

- Primary action is obvious within 3 seconds.
- Page remains understandable when data is empty.
- Dangerous actions require confirmation.
- Keyboard navigation works across primary flows.
- Visual rhythm is consistent (spacing scale + consistent radii).
- No component is used decoratively without purpose.
