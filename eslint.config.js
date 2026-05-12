// ESLint is not currently wired into this repo. The `lint` script in package.json is
// `next lint` which was removed in Next 16; CI's `lint` job only runs prettier +
// link-check. This file is a placeholder so the rule below is ready to enforce as soon
// as ESLint is introduced (likely as part of a Next 16 lint-migration ticket).
//
// When wiring ESLint:
//   1. Add eslint + @typescript-eslint/parser as devDeps
//   2. Uncomment the export below
//   3. Add `pnpm eslint .` to the CI `lint` job in .github/workflows/tests.yml
//
// The rule bans bare `router.back()` calls outside src/hooks/useSafeBack.ts itself.
// Without this guard, the navigation bug class fixed in PR #1965 will reappear: any
// new screen reached via deep link / QR scan / push notification will have a no-op
// back button if the dev forgets to use `useSafeBack` and falls back to `router.back()`.
// See src/hooks/useSafeBack.ts for the rationale.

// module.exports = [
//     {
//         files: ['src/**/*.{ts,tsx}'],
//         rules: {
//             'no-restricted-syntax': [
//                 'error',
//                 {
//                     selector:
//                         "CallExpression[callee.object.name='router'][callee.property.name='back']",
//                     message:
//                         "Don't call router.back() directly — it no-ops on deep-link entries " +
//                         '(cold tab, QR scan, push notification). Use useSafeBack(fallbackUrl) ' +
//                         "from '@/hooks/useSafeBack' instead, which falls back to a known parent " +
//                         'URL when there is no in-app history. See PR #1965.',
//                 },
//             ],
//         },
//     },
//     {
//         // The hook itself wraps router.back() — exempt.
//         files: ['src/hooks/useSafeBack.ts', 'src/hooks/__tests__/useSafeBack.test.ts'],
//         rules: { 'no-restricted-syntax': 'off' },
//     },
//     {
//         // Capacitor hardware back button is a different bug class (canGoBack + minimizeApp
//         // semantics). Warn rather than error so a future migration is considered, not auto-blocked.
//         files: ['src/hooks/useNativePlugins.ts'],
//         rules: {
//             'no-restricted-syntax': [
//                 'warn',
//                 {
//                     selector:
//                         "CallExpression[callee.object.name='router'][callee.property.name='back']",
//                     message:
//                         'Capacitor hardware back — different bug class from browser/UI back. ' +
//                         'useSafeBack does not cover the canGoBack + minimize-app semantics here.',
//                 },
//             ],
//         },
//     },
// ]
