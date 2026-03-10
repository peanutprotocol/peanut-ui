# peanut-ui Development Rules

**Version:** 1.0.0 | **Updated:** 2026-03-10

Single source of truth for developer and AI assistant rules. Tool-specific files (`.cursorrules`, `CLAUDE.md`, `AGENTS.md`, `.windsurfrules`) are symlinks to this file.

---

## 🚫 Agent Safety

- **Never open SVG files** — crashes AI agents. Only read jpeg, png, gif, or webp.
- **Never run `jq`** — crashes AI agents.
- **Never run `sleep`** from command line — hibernates the PC.
- **Never add AI co-author to commits** — no "Co-Authored-By" lines for AI assistants.
- **Do not generate .md files** unless explicitly told to.

## 🔀 Git Workflow

- **NEVER commit or push directly to main** — all changes must go through a pull request. No exceptions.
- **Always work from a feature branch** — create a branch, push it, open a PR, wait for CI to pass, then merge.
- **Use git worktrees** for parallel work (`claude --worktree <name>` or `git worktree add`).
- Multiple agents/sessions must use separate worktrees to avoid collisions.

## 💻 Code Quality

- **Boy scout rule** — leave code better than you found it.
- **DRY** — reuse existing code and shared constants (e.g. `src/constants`). Less code is better code.
- **Separate business logic from UI** — important for readability, debugging, and testability.
- **Use explicit imports** — no wildcard imports, import from specific files.
- **Reuse existing components and functions** — don't hardcode hacky solutions.
- **Warn about breaking changes** — if there's risk, explicitly WARN. Flag if frontend changes require backend action (or vice versa).
- **Mention refactor opportunities** — if you spot one, mention it. DO NOT make changes unless explicitly told to.
- **Error messages** — user-facing errors should be friendly and clear. Console/Sentry errors should be descriptive for debugging.

## 🚫 Import Rules (critical for build performance)

- **No barrel imports** — never `import * as X from '@/constants'` or create index.ts barrel files. Import from specific files (e.g. `import { PEANUT_API_URL } from '@/constants/general.consts'`).
- **No circular dependencies** — check if target file imports from current file before adding imports. Move shared types to `interfaces.ts` if needed.
- **No Node.js packages in client components** — `web-push`, `fs`, `crypto` (node) can't be used in `'use client'` files. Use server actions or API routes instead.
- **Check for legacy code** — before importing, check for TODO comments marking code as legacy/deprecated. Prefer newer implementations.

## 🚫 Export Rules

- **One component per file** — never export multiple components from the same file.
- **Separate types** — never export types from a component or hook file. Use a separate file if types need to be reused.
- **Separate utils** — utility/helper functions go in a separate utils file.

## 🔗 URL as State (Critical for UX)

- **URL is source of truth** — use query parameters for user-facing state that should survive navigation, refresh, or sharing (step indicators, amounts, filters, view modes, selected items).
- **Use nuqs library** — always use `useQueryStates` for type-safe URL state management. Never manually parse/set query params with `router.push` or `URLSearchParams`.
- **Enable deep-linking** — users should be able to share or bookmark URLs mid-flow (e.g. `?step=inputAmount&amount=500&currency=ARS`).
- **Multi-step flows** — URL should always reflect current step and relevant data. Proper back/forward browser button behavior.
- **Reserve `useState` for ephemeral UI only** — loading spinners, modal open/close, form validation errors, hover/focus states, temporary animations.
- **Don't URL-ify everything** — API responses, auth state, and internal component state generally don't belong in the URL.
- **Type safety** — define parsers for query params (`parseAsInteger`, `parseAsStringEnum`).

## 🎨 Design System

- **Live showcase**: visit `/dev/components` to see all components rendered with all variants.
- **Three layers**: Bruddle primitives (`src/components/0_Bruddle/`), Global shared (`src/components/Global/`), Tailwind custom classes (`tailwind.config.js`).

### Color Names (misleading!)

- `purple-1` / `primary-1` = `#FF90E8` (PINK, not purple)
- `primary-3` = `#EFE4FF` (lavender)
- `yellow-1` / `secondary-1` = `#FFC900`
- `green-1` = `#98E9AB`

### Key Rules

- **Button sizing trap**: `size="large"` is `h-10` (40px) — SHORTER than default `h-13` (52px). Never use for primary CTAs.
- **Primary CTA**: `<Button variant="purple" shadowSize="4" className="w-full">` — no size prop.
- **Secondary CTA**: `<Button variant="stroke" className="w-full">`
- **Shadows**: always black `#000000`. Use `shadowSize="4"` for action buttons.
- **Border radius**: always `rounded-sm` (not rounded-lg or rounded-md).
- **Border stroke**: `border border-n-1` (1px black).
- **Links**: `text-black underline` — never `text-purple-1` (that's pink).
- **Text hierarchy**: `text-n-1` primary, `text-grey-1` secondary.
- **Two Card components**: `0_Bruddle/Card` (standalone containers, named export) vs `Global/Card` (stacked list items, default export).
- **Backgrounds**: `bg-peanut-repeat-normal` for waving peanut pattern.
- **Messaging**: use "starter balance" for card deposits — never "card balance" or "Peanut rewards".

### Bruddle Primitives (`0_Bruddle/`)

Button, Card (named export), BaseInput, BaseSelect, Checkbox, Divider, Title, Toast, PageContainer, CloudsBackground

### Global Shared Components (`Global/`)

- **Navigation**: NavHeader (back button + title), TopNavbar, Footer
- **Modals**: Modal (base @headlessui Dialog), ActionModal (with buttons/checkboxes/icons), Drawer (vaul bottom sheet)
- **Loading**: Loading (spinner), PeanutLoading (branded), PeanutFactsLoading (with fun facts)
- **Cards**: Card (with position prop for stacked lists), InfoCard, PeanutActionCard
- **Status**: StatusPill, StatusBadge, ErrorAlert, ProgressBar
- **Icons**: Icon component with 50+ icons — `<Icon name="check" size={20} />`
- **Inputs**: AmountInput, ValidatedInput, CopyField, GeneralRecipientInput, TokenSelector
- **Utilities**: CopyToClipboard, AddressLink, ExternalWalletButton, ShareButton, Banner, MarqueeWrapper

### Page Layouts

- **Outer shell**: `flex min-h-[inherit] flex-col gap-8` — NavHeader is first child.
- **Centered content + CTA** (default): wrap content AND CTA in `<div className="my-auto flex flex-col gap-6">`. CTA must be INSIDE this div, never a sibling.
- **Pinned footer CTA**: add `justify-between` to outer div, CTA as last child outside content.
- **Never** use `space-y-*` on the outer flex div (conflicts with centering) — use `gap-*` instead.

## 🚀 Performance

- **Cache where possible** — avoid unnecessary re-renders and data fetching.
- **Fire simultaneous requests** — if multiple awaits are independent, fire them in parallel.
- **Service Worker cache version** — only bump `NEXT_PUBLIC_API_VERSION` for breaking API changes (see JSDoc in `src/app/sw.ts`).
- **Gate heavy features in dev** — prefetching, precompiling, eager loading can add 5-10s to dev cold starts. Wrap with `process.env.NODE_ENV !== 'development'`.

## 🧪 Testing

- **Jest** — tests placed in `__tests__` directories next to code, named `*.test.ts` or `*.test.tsx`.
- **Run**: `npm test` (fast, ~5s) — all suites must pass.
- **Test new code** where tests make sense, especially with fast unit tests.

## 📁 Documentation

- **All docs go in `docs/`** (except root `README.md` and `CONTRIBUTING.md`).
- **Keep it concise** — AI tends to be verbose. No one reads that.
- **Check existing docs** before creating new ones — merge instead of duplicate.
- **Delete or edit outdated docs** instead of creating new ones.
- **Maintain PR.md for PRs** — concise `docs/PR.md` with: summary, risks, QA guidelines.

## ✅ Before Pushing

1. **Format**: `pnpm prettier --write <changed-files>` then `pnpm prettier --check .`
2. **Typecheck**: `npm run typecheck` — catches type errors tests miss
3. **Test**: `npm test` (~5s) — all suites must pass
4. **Build** (if touching imports/types): `npm run build`

## 📝 Commits

- **Be descriptive** — focus on the "why", not the "what".
- follow conventional commits.
