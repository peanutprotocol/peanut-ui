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

## 📱 Native App (Android)

### Architecture

- same next.js codebase builds for both web (SSR on vercel) and native (static export via capacitor)
- `scripts/native-build.js` handles the static export — disables server features, wraps dynamic routes, swaps configs
- `android/` is source code (not generated) — tracked in git. generated files are in `android/.gitignore`
- `.env.production.local` controls which backend the native app points to (currently staging, gitignored)
- `capacitor.config.ts` loads `.env.production.local` manually since capacitor CLI doesn't read next.js env files

### Building

```bash
# 1. static export
node scripts/native-build.js

# 2. sync with android project
npx cap sync android

# 3. run on device (debug build — passkeys won't work)
npx cap run android

# 4. release AAB for play console
cd android && ./gradlew bundleRelease
# output: android/app/build/outputs/bundle/release/app-release.aab
```

- passkeys only work on play store builds (signed with play app signing key). local debug builds show the credential manager but biometric step fails. always test passkeys via play store internal testing.

### Version Management

- `versionCode` in `android/app/build.gradle` — must increment for every play console upload. play console rejects duplicates.
- `versionName` — human-readable version (e.g. "1.0.9"). shown to users.
- always bump both before building a new AAB.

### OTA Updates (Capgo)

- **JS/CSS/HTML changes** — push via capgo, no store review needed
- **native changes** (android/, AndroidManifest.xml, new plugins, capacitor.config.ts) — require new AAB upload to play console

```bash
# manual OTA push
node scripts/native-build.js
npx @capgo/cli bundle upload --channel staging --bundle <version>
# bundle version must be higher than native versionName or capgo rejects it
```

- **auto-deploy** via `.github/workflows/capgo-deploy.yml`:
  - push to `dev` → `staging` channel (internal testers)
  - push to `main` → `production` channel (all users)
  - requires `CAPGO_API_KEY` secret in github repo settings
- capgo calls `notifyAppReady()` on every launch — if not called within 15s, auto-rolls back to previous bundle

### Writing Native-Compatible Code

**dynamic routes:**
- static export doesn't support `[country]` style routes
- `native-build.js` disables dynamic dirs and copies pages to stub files (e.g. `_onramp-bank.tsx`)
- parent pages handle query params: `/add-money?country=argentina&view=bank` instead of `/add-money/argentina/bank`
- use route helpers from `src/utils/native-routes.ts` for navigation
- components must read from both `useParams()` AND `useSearchParams()` to work on web and native:
  ```ts
  const country = (params.country as string) || searchParams.get('country') || ''
  ```

**capacitor plugin imports:**
- do NOT use `/* webpackIgnore: true */` — breaks OTA updates (browser can't resolve bare module specifiers)
- use regular dynamic imports: `const { Browser } = await import('@capacitor/browser')`
- guard with `isCapacitor()` — safe to bundle for web (never executed)

**platform detection** (`src/utils/capacitor.ts`):
- `isCapacitor()` — true when running in capacitor webview
- `isAndroidNative()` / `isIOSNative()` — platform-specific
- `getNativeRpId()` — passkey rpId for native (from `NEXT_PUBLIC_NATIVE_RP_ID`)

**no server features in native:**
- no `'use server'` directives — use `getAuthHeaders()` from `src/utils/auth-token.ts`
- no `cookies()` from next/headers — use `getAuthToken()` which reads from localStorage on native
- no relative `/api/` calls — use `apiFetch()` or direct backend URLs with `PEANUT_API_URL`

### Passkeys

- `@capgo/capacitor-passkey` with `autoShim: true` patches `navigator.credentials` so zerodev's `toWebAuthnKey()` works on all platforms
- backend `ANDROID_ORIGINS` must include `android:apk-key-hash:<hash>` for each signing key
- `assetlinks.json` at the rpId domain must include the app's signing key SHA-256 fingerprints
- to generate apk-key-hash from a fingerprint: `echo "FINGERPRINT" | tr -d ':' | xxd -r -p | base64 | tr '+/' '-_' | tr -d '='`

### Key Files

| file | purpose |
|------|---------|
| `capacitor.config.ts` | app ID, plugins, loads `.env.production.local` |
| `scripts/native-build.js` | static export pipeline — disables server features, wraps dynamic routes |
| `next.config.native.js` | next.js config for `output: 'export'` |
| `.env.production.local` | backend URLs for native build (gitignored) |
| `android/app/build.gradle` | version codes, signing config, dependencies |
| `android/app/src/main/AndroidManifest.xml` | permissions |
| `android/app/src/main/java/me/peanut/app/MainActivity.java` | SPA fallback routing in webview |
| `src/utils/capacitor.ts` | platform detection, `isCapacitor()`, `getNativeRpId()` |
| `src/utils/native-routes.ts` | URL helpers for dynamic route → query param conversion |
| `src/utils/native-webauthn.ts` | passkey signing callback for native |

### What NOT to Commit

- stub files with real page content (overwritten during native build, restored automatically after)
- `next.config.js` swapped with native version (restored automatically after native build)
- `android/` generated files: `build/`, `.gradle/`, `local.properties`, `capacitor.config.json`, `capacitor.plugins.json`, `capacitor-cordova-android-plugins/`, `app/src/main/assets/public/`

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
