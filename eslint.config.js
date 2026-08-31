// ESLint flat config for peanut-ui (Next 16 / React 19 / TypeScript).
// Baseline rules: TypeScript recommended, React recommended, React Hooks, Next.js.
// Plus a project-specific rule banning bare router.back() outside useSafeBack (PR #1965).

const tsParser = require('@typescript-eslint/parser')
const tsPlugin = require('@typescript-eslint/eslint-plugin')
const reactPlugin = require('eslint-plugin-react')
const reactHooksPlugin = require('eslint-plugin-react-hooks')
const nextPlugin = require('@next/eslint-plugin-next')
const importPlugin = require('eslint-plugin-import-x')
const globals = require('globals')
const copyPropsFromCatalog = require('./eslint-rules/copy-props-from-catalog')

// Barrel paths banned by CLAUDE.md ("no barrel imports — never `import * as X from
// '@/constants'` or create `index.ts` barrels. Import from specific files"). The bare
// alias resolves to `<dir>/index.{ts,tsx}` which forces the bundler to load every
// re-export, hurting build perf. Existing violations remain (~135 across the codebase)
// — the guard is preventative; cleanup belongs in a separate sweep.
const BANNED_BARREL_PATHS = ['@/constants', '@/components', '@/assets', '@/context', '@/interfaces', '@/config']

const RESTRICTED_IMPORT_PATHS = BANNED_BARREL_PATHS.map((path) => ({
    name: path,
    message: `Import from a specific file instead of the '${path}' barrel — barrels force the bundler to load every re-export and hurt build perf. See CLAUDE.md.`,
}))

// DS 10 (TASK-21450): URL state belongs to nuqs. CLAUDE.md "URL as State": use
// useQueryStates, never manually parse/set query params with router.push or
// URLSearchParams. Existing offenders are allowlisted below (ratchet — remove
// entries as files migrate); only NEW files are blocked from the pattern.
// tw.ts wraps tailwind-merge with the DS token groups registered; a raw import
// (e.g. a copy-pasted shadcn cn() helper) reintroduces the silent class-deletion
// bug tw.ts exists to fix — unrecognised DS tokens get treated as conflicting
// colors and dropped. Only src/utils/tw.ts itself may import the package.
const TAILWIND_MERGE_IMPORT_RESTRICTION = {
    name: 'tailwind-merge',
    message:
        "Import { twMerge } from '@/utils/tw' — raw tailwind-merge doesn't know the DS token groups and silently deletes DS classes.",
}

const USE_SEARCH_PARAMS_IMPORT_RESTRICTION = {
    name: 'next/navigation',
    importNames: ['useSearchParams'],
    message:
        "Don't read query params with useSearchParams — use useQueryStates from 'nuqs' (typed parsers, URL as state). See CLAUDE.md 'URL as State'. DS 10 ratchet: existing files are allowlisted; new files must use nuqs.",
}

const QUERY_STRING_PUSH_MESSAGE =
    "Don't build a query string by hand for router.push/replace — write URL state with useQueryStates from 'nuqs' (its setter updates the params in place; pathname-only navigation is fine). See CLAUDE.md 'URL as State'. DS 10 ratchet: existing files are allowlisted; new files must use nuqs."

// Best-effort: catches router.push('/x?y=1') and router.push(`/x?y=${z}`) — a '?'
// in a string/template argument means a hand-built query string. Concatenations
// ('/x' + qs) and variables slip through; keeping the selector simple keeps it
// false-positive-free for pathname-only pushes.
const QUERY_STRING_PUSH_RESTRICTIONS = [
    {
        selector:
            "CallExpression[callee.object.name='router'][callee.property.name=/^(push|replace)$/] > Literal[value=/\\?/]",
        message: QUERY_STRING_PUSH_MESSAGE,
    },
    {
        selector:
            "CallExpression[callee.object.name='router'][callee.property.name=/^(push|replace)$/] > TemplateLiteral > TemplateElement[value.raw=/\\?/]",
        message: QUERY_STRING_PUSH_MESSAGE,
    },
]

// Pre-DS-10 syntax restrictions — shared so the DS 10 allowlist block below can
// re-apply them while dropping only the query-string-push restriction.
const RESTRICTED_SYNTAX_BASE = [
    {
        selector: "CallExpression[callee.object.name='router'][callee.property.name='back']",
        message:
            "Don't call router.back() directly — it no-ops on deep-link entries (cold tab, QR scan, push notification). Use useSafeBack(fallbackUrl) from '@/hooks/useSafeBack' instead. See PR #1965.",
    },
    {
        // Only matches the simple () => router.push|replace(x) arrow-body shape —
        // multi-statement handlers (state resets, conditional branches) keep their
        // freedom since they often combine navigation with intentional side effects.
        selector:
            "JSXAttribute[name.name=/^(onPrev|onBack)$/] > JSXExpressionContainer > ArrowFunctionExpression[body.type='CallExpression'][body.callee.object.name='router'][body.callee.property.name=/^(push|replace)$/]",
        message:
            'Bare router.push/replace as onPrev/onBack creates a parent↔child cycle once the parent uses useSafeBack (the push grows in-app history, useSafeBack pops back to this screen, repeat). Use useSafeBack(parentUrl) — pass { replace: true } to preserve replace semantics. See PR #1997.',
    },
    {
        selector:
            "MemberExpression[object.object.name='window'][object.property.name='history'][property.name='length']",
        message:
            "window.history.length is the pre-useSafeBack idiom (history.length > 1 ? back : push). It misfires on cold-load from external referrers — useSafeBack's pushState counter is more accurate. See PR #1965.",
    },
    {
        // nuqs `history: 'push'` stacks a browser-history entry on every URL write.
        // For per-keystroke params (e.g. `amount`) that poisons the back stack:
        // useSafeBack → router.back() then steps through stale same-screen states
        // and the back button looks dead (add-money MP/bank reports, June 2026).
        selector: "CallExpression[callee.name=/^useQueryStates?$/] Property[key.name='history'][value.value='push']",
        message:
            "Don't pass { history: 'push' } to nuqs useQueryState(s) — a history entry per URL write breaks the back button (useSafeBack steps through same-screen states instead of leaving). Use the default 'replace'; the URL stays shareable. If a flow genuinely needs push-per-step, add a scoped file exemption with a comment (see useNativePlugins).",
    },
    {
        // Toast copy must come from next-intl. `react/jsx-no-literals` below
        // only inspects JSX children, so toasts fired from hooks and contexts
        // (authContext, useLogin, useSendMoney, QRScanner) shipped English to
        // every locale unnoticed.
        //
        // Deliberately NOT extended to `throw new Error('…')`: those messages
        // are developer/Sentry breadcrumbs that the friendly-error mapper
        // collapses to `errors.genericSupport` before any user sees them, so
        // translating them would only fragment Sentry issue grouping.
        selector:
            "CallExpression[callee.object.name='toast'][callee.property.name=/^(error|success|info|warning|loading)$/] > :matches(Literal, TemplateLiteral):first-child",
        message:
            "Don't pass a string literal to toast.* — copy must come from next-intl. Import the right namespace with useTranslations and pass t('…'). If the value genuinely isn't copy (an id, a URL), assign it to a named const first.",
    },
    {
        // iOS has never implemented the Vibration API — not in any version,
        // Safari or WKWebView — so navigator.vibrate() is a permanent no-op
        // there, and the `'vibrate' in navigator` guard that usually wraps it
        // makes the failure completely silent. On Android it works but only
        // above a duration threshold no call site was passing. Every native
        // haptic in the app was dead this way until 1.0.48.
        selector: "CallExpression[callee.object.name='navigator'][callee.property.name='vibrate']",
        message:
            "Don't call navigator.vibrate() directly — it is a permanent no-op on iOS (no Vibration API in any version) and silently does nothing. Use notifyHaptic / impactHaptic / vibrateHaptic / cancelHaptic from '@/utils/haptics', which drive @capacitor/haptics on native, or useAppHaptic() from '@/hooks/useAppHaptic' for a light tap in a component.",
    },
    {
        // Settling a promise WITH a Capacitor plugin object probes its .then,
        // and the registerPlugin proxy answers any property with a
        // native-method wrapper that never invokes the callbacks it is handed
        // — so the promise stays pending forever and even the .catch is dead.
        // Shipped twice: getPreferences() (1.0.44) and the Crisp helper
        // (1.0.45–1.0.47). Return { Plugin } instead.
        selector: 'ReturnStatement > Identifier[name=/^(Capacitor[A-Z]|Preferences$)/]',
        message:
            'Never return a Capacitor plugin object across an await/then boundary — resolving a promise with it probes .then, which the plugin proxy turns into a native call that never settles the promise. Wrap it: `return { Plugin }` and destructure at the call site. See src/utils/crisp.ts and src/utils/auth-token.ts.',
    },
]

module.exports = [
    {
        ignores: [
            '.next/**',
            'out/**',
            'dist/**',
            'node_modules/**',
            'public/**',
            'src/content/**',
            'android/**',
            'ios/**',
            'build/**',
            'src/types/api.generated.ts',
            'coverage/**',
            'playwright-report/**',
            'test-results/**',
            // Submodule + generated
            'engineering/**',
            'src/assets/**',
        ],
    },
    {
        files: ['src/**/*.{ts,tsx}'],
        languageOptions: {
            parser: tsParser,
            parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },
            globals: { ...globals.browser, ...globals.node },
        },
        plugins: {
            '@typescript-eslint': tsPlugin,
            react: reactPlugin,
            'react-hooks': reactHooksPlugin,
            '@next/next': nextPlugin,
            'import-x': importPlugin,
        },
        settings: {
            react: { version: 'detect' },
            'import-x/resolver': {
                typescript: { project: './tsconfig.json' },
                node: true,
            },
        },
        rules: {
            ...tsPlugin.configs.recommended.rules,
            ...reactPlugin.configs.recommended.rules,
            ...reactHooksPlugin.configs.recommended.rules,
            ...nextPlugin.configs.recommended.rules,
            ...nextPlugin.configs['core-web-vitals'].rules,

            // Prefix with `_` to mark an intentionally-unused binding.
            '@typescript-eslint/no-unused-vars': [
                'error',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    caughtErrorsIgnorePattern: '^_',
                    destructuredArrayIgnorePattern: '^_',
                    ignoreRestSiblings: true,
                },
            ],

            // React 17+ — no need to import React for JSX
            'react/react-in-jsx-scope': 'off',
            'react/jsx-uses-react': 'off',
            // We use TypeScript for prop validation
            'react/prop-types': 'off',
            // Allow unescaped quotes — too noisy and prettier handles spacing
            'react/no-unescaped-entities': 'off',
            // `jsx`/`global` are styled-jsx's <style> attributes (built into Next), not DOM props.
            'react/no-unknown-property': ['error', { ignore: ['jsx', 'global'] }],

            // Ban barrel imports (see BANNED_BARREL_PATHS) + useSearchParams (DS 10).
            'no-restricted-imports': [
                'error',
                {
                    paths: [
                        ...RESTRICTED_IMPORT_PATHS,
                        USE_SEARCH_PARAMS_IMPORT_RESTRICTION,
                        TAILWIND_MERGE_IMPORT_RESTRICTION,
                    ],
                },
            ],

            // Ban self-imports — CLAUDE.md import rules. Confirmed firing on synthetic test.
            'import-x/no-self-import': 'error',
            // import-x/no-cycle is intentionally NOT enabled. The plugin's no-cycle silently
            // fails on synthetic A↔B cycles under ESLint 9 flat config in this setup —
            // verified against both eslint-plugin-import 2.32 and eslint-plugin-import-x 4.16.
            // Self-imports are still caught above. Revisit when the plugin matures or someone
            // figures out the resolver gotcha.

            // Project-specific: catch the back-button bug class (RESTRICTED_SYNTAX_BASE —
            // PR #1965 router.back, PR #1997 sibling patterns, nuqs history:'push',
            // toast literals) + hand-built query-string pushes (DS 10, TASK-21450).
            'no-restricted-syntax': ['error', ...RESTRICTED_SYNTAX_BASE, ...QUERY_STRING_PUSH_RESTRICTIONS],
        },
    },
    {
        // The hook itself wraps router.back() — exempt.
        files: ['src/hooks/useSafeBack.ts', 'src/hooks/__tests__/useSafeBack.test.ts'],
        rules: { 'no-restricted-syntax': 'off' },
    },
    {
        // The one module allowed to touch the Vibration API: it is the web
        // fallback behind the haptics helpers everything else must use.
        files: ['src/utils/haptics.ts'],
        rules: { 'no-restricted-syntax': 'off' },
    },
    {
        // The wrapper itself (and its census test) are the only legal raw
        // tailwind-merge importers.
        files: ['src/utils/tw.ts', 'src/utils/__tests__/tw.test.ts'],
        rules: { 'no-restricted-imports': 'off' },
    },
    {
        // Capacitor hardware back: different bug class (canGoBack + minimizeApp).
        files: ['src/hooks/useNativePlugins.ts'],
        rules: { 'no-restricted-syntax': 'off' },
    },
    {
        // PublicProfile is the one place we intentionally keep an isInternalReferrer +
        // window.history.length check. The referrer signal is orthogonal to useSafeBack's
        // counter; migrating loses information for external-referrer cold-loads.
        // Scoped, not blanket off: only the two selectors that idiom needs are dropped
        // (history.length + the router.back it gates), so the other restrictions still
        // apply here. The file also has one pre-ban query push (`/invite?code=…`) —
        // treat it as a DS 10 ratchet allowlist member (TASK-21450): the query-push
        // restrictions are not re-applied; migrate it to nuqs, then re-add.
        files: ['src/components/Profile/components/PublicProfile.tsx'],
        rules: {
            'no-restricted-syntax': [
                'error',
                ...RESTRICTED_SYNTAX_BASE.filter(
                    (r) =>
                        !r.selector.includes("[property.name='length']") &&
                        !r.selector.includes("[callee.property.name='back']")
                ),
            ],
        },
    },
    {
        // DS 10 ratchet allowlist — do not add files; migrate to nuqs instead
        // (remove entries as files migrate). These files imported useSearchParams
        // before the ban (TASK-21450); the barrel-import ban still applies.
        files: [
            // NOTE: [ and ] are minimatch character classes — dynamic-segment dirs
            // like [country] must be escaped as \\[country\\] to match literally.
            'src/app/(mobile-ui)/add-money/\\[country\\]/\\[regional-method\\]/page.tsx',
            'src/app/(mobile-ui)/add-money/\\[country\\]/bank/page.tsx',
            'src/app/(mobile-ui)/add-money/page.tsx',
            'src/app/(mobile-ui)/card-payment/page.tsx',
            'src/app/(mobile-ui)/dev/payment-graph/page.tsx',
            'src/app/(mobile-ui)/pay-request/page.tsx',
            'src/app/(mobile-ui)/qr-pay/page.tsx',
            'src/app/(mobile-ui)/qr/\\[code\\]/page.tsx',
            'src/app/(mobile-ui)/qr/\\[code\\]/success/page.tsx',
            'src/app/(mobile-ui)/qr/page.tsx',
            'src/app/(mobile-ui)/receipt/page.tsx',
            'src/app/(mobile-ui)/request/page.tsx',
            'src/app/(mobile-ui)/withdraw/\\[country\\]/bank/page.tsx',
            'src/app/(mobile-ui)/withdraw/manteca/page.tsx',
            'src/app/(mobile-ui)/withdraw/page.tsx',
            'src/app/(setup)/setup/page.tsx',
            'src/app/\\[...recipient\\]/client.tsx',
            'src/app/crisp-proxy/page.tsx',
            'src/app/quests/\\[questId\\]/page.tsx',
            'src/app/quests/components/QuestsHero.tsx',
            'src/app/quests/explore/page.tsx',
            'src/app/recover-wallet/page.tsx',
            'src/components/AddMoney/components/MantecaAddMoney.tsx',
            'src/components/AddWithdraw/AddWithdrawCountriesList.tsx',
            'src/components/AddWithdraw/AddWithdrawRouterView.tsx',
            'src/components/AddWithdraw/DynamicBankAccountForm.tsx',
            'src/components/Claim/Claim.tsx',
            'src/components/Claim/Link/Initial.view.tsx',
            'src/components/Claim/Link/Onchain/Confirm.view.tsx',
            'src/components/Claim/Link/Onchain/Success.view.tsx',
            'src/components/Claim/Link/views/BankFlowManager.view.tsx',
            'src/components/Claim/useClaimLink.tsx',
            'src/components/Common/CountryList.tsx',
            'src/components/Global/QRScannerOverlay/index.tsx',
            'src/components/Global/UnsupportedBrowserModal/index.tsx',
            'src/components/Invites/InvitesPage.tsx',
            'src/components/Marketing/HelpLanding.tsx',
            'src/components/Request/Pay/Pay.tsx',
            'src/components/Request/link/views/Create.request.link.view.tsx',
            'src/components/Send/views/Contacts.view.tsx',
            'src/components/Send/views/SendRouter.view.tsx',
            'src/context/ReproduceBootstrap.tsx',
            'src/features/payments/flows/semantic-request/SemanticRequestPageWrapper.tsx',
            'src/features/payments/flows/semantic-request/views/SemanticRequestConfirmView.tsx',
            'src/features/payments/flows/semantic-request/views/SemanticRequestSuccessView.tsx',
            'src/hooks/useAccountSetup.ts',
            'src/hooks/useLogin.tsx',
            'src/hooks/useSendFlowOrigin.ts',
        ],
        rules: {
            'no-restricted-imports': ['error', { paths: RESTRICTED_IMPORT_PATHS }],
        },
    },
    {
        // DS 10 ratchet allowlist — do not add files; migrate to nuqs instead
        // (remove entries as files migrate). These files pushed hand-built query
        // strings before the ban (TASK-21450); every other syntax restriction
        // (RESTRICTED_SYNTAX_BASE) still applies.
        files: [
            'src/app/(mobile-ui)/add-money/page.tsx',
            'src/app/(mobile-ui)/qr-pay/page.tsx',
            'src/app/(mobile-ui)/withdraw/page.tsx',
            'src/app/lp/card/CardLandingPage.tsx',
            'src/app/shhhhh/ShhhhhLandingPage.tsx',
            'src/components/AddMoney/views/AddMoneyMethodSelection.view.tsx',
            'src/components/AddWithdraw/AddWithdrawCountriesList.tsx',
            'src/components/AddWithdraw/AddWithdrawRouterView.tsx',
            'src/components/Claim/Link/SendLinkActionList.tsx',
            'src/components/Global/GuestVerificationModal/index.tsx',
            'src/components/Marketing/mdx/ExchangeWidget.tsx',
            'src/components/Send/views/Contacts.view.tsx',
            'src/components/Send/views/SendRouter.view.tsx',
            'src/features/payments/flows/contribute-pot/components/RequestPotActionList.tsx',
            'src/features/payments/flows/semantic-request/views/SemanticRequestConfirmView.tsx',
            'src/features/payments/flows/semantic-request/views/SemanticRequestSuccessView.tsx',
            'src/features/payments/shared/components/PaymentMethodActionList.tsx',
        ],
        rules: {
            'no-restricted-syntax': ['error', ...RESTRICTED_SYNTAX_BASE],
        },
    },
    {
        // require() inside test bodies is the Jest idiom for reading mocks after
        // jest.mock()/resetModules(); hoisting them to imports changes semantics.
        // no-img-element: these files mock next/image down to a raw <img>.
        // no-explicit-any: mocks and partial fixtures legitimately cast through
        // `any` — production code keeps the ban.
        files: ['src/**/__tests__/**/*.{ts,tsx}', 'src/**/*.test.{ts,tsx}', 'src/**/__mocks__/**/*.{ts,tsx}'],
        rules: {
            '@typescript-eslint/no-require-imports': 'off',
            '@next/next/no-img-element': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
        },
    },
    {
        // Dev-only tooling: /dev pages, the window.debug console cheats, and the
        // InvitesGraph debug visualization. The cheat API is intrinsically dynamic
        // and d3/force-graph mutate node objects at runtime — typing them buys no
        // user-facing safety. Production code keeps the any ban.
        files: ['src/app/(mobile-ui)/dev/**', 'src/context/PeanutDebug.tsx', 'src/components/Global/InvitesGraph/**'],
        rules: { '@typescript-eslint/no-explicit-any': 'off' },
    },
    {
        // OG images render through Satori (next/og ImageResponse), which supports
        // only a subset of HTML/CSS and cannot render next/image — raw <img> with
        // explicit width/height is the required form here, not an oversight.
        files: ['src/components/og/**', 'src/app/api/og/**'],
        rules: { '@next/next/no-img-element': 'off' },
    },
    {
        // Rasterized to PNG by html-to-image (see share-asset/captureShareAsset.ts).
        // next/image's lazy loading and wrapper markup break the capture — the same
        // class of bug as the runtime <canvas> that file already documents.
        files: ['src/components/Card/share-asset/**', 'src/components/Global/ImageGeneration/**'],
        rules: { '@next/next/no-img-element': 'off' },
    },
    {
        // Localization guard: product-UI copy must come from next-intl, not JSX
        // literals. Scoped to the translated surface — marketing (its own i18n),
        // the /dev design-system catalog, and shared primitives that receive copy
        // as props are excluded. allowedStrings covers the symbols/masks that are
        // not translatable copy (card masks, %, currency glyphs, arrows).
        files: [
            'src/app/(mobile-ui)/**/*.tsx',
            'src/app/(setup)/**/*.tsx',
            // Top-level app routes sit outside the route groups above; without
            // them listed the guard cannot see their copy (/shhhhh shipped
            // English-only to every locale because of exactly that gap).
            'src/app/shhhhh/**/*.tsx',
            'src/app/kyc/**/*.tsx',
            'src/app/invite/**/*.tsx',
            'src/components/{Home,Send,Request,Profile,Setup,Settings,Card,AddMoney,AddWithdraw,Withdraw,Claim,Payment,Points,Badges,Notifications,Invites,TransactionDetails,Kyc,IdentityVerification,ExchangeRate,Common,ForceIOSPWAInstall,User,Migration}/**/*.tsx',
            'src/components/Global/**/*.tsx',
            'src/features/**/*.tsx',
        ],
        ignores: [
            'src/app/(mobile-ui)/dev/**',
            'src/**/__tests__/**',
            'src/**/*.test.tsx',
            // Marketing-shared Global components render on marketing pages (whose
            // locale comes from the URL, not the app context) — they keep English
            // and take any product-UI copy as props. FAQs/ExchangeRateWidget are
            // imported by LandingPage and Marketing/mdx; Loading is a spinner
            // fallback reached through the shared 0_Bruddle/Button.
            'src/components/Global/{Layout,AnimateOnView,MarqueeWrapper,FAQs,FooterVisibilityObserver,ExchangeRateWidget,Modal,Loading}/**',
            'src/components/Global/{Layout,AnimateOnView,MarqueeWrapper,FAQs,FooterVisibilityObserver,ExchangeRateWidget,Modal,Loading}.tsx',
            'src/components/Global/{PeanutLoading,Icons}/**',
            // InvitesGraph is a /dev-only debug visualization, not user-facing UI.
            'src/components/Global/InvitesGraph/**',
            // The payment network explorer is a team-gated /dev tool; its copy is
            // intentionally English-only.
            'src/features/payment-network-explorer/**',
            // Hidden support tool — never linked in-app; support DMs the URL to
            // affected users, so the copy stays English-only.
            'src/app/(mobile-ui)/fix-card-signature/**',
        ],
        plugins: { local: { rules: { 'copy-props-from-catalog': copyPropsFromCatalog } } },
        rules: {
            // Companion to jsx-no-literals below, which only sees JSX children:
            // this catches copy handed to a component as a prop.
            'local/copy-props-from-catalog': 'error',
            'react/jsx-no-literals': [
                'error',
                {
                    noStrings: false,
                    ignoreProps: true,
                    allowedStrings: [
                        '•',
                        '·',
                        '%',
                        '$',
                        '(',
                        ')',
                        '-',
                        '/',
                        ':',
                        '#',
                        '+',
                        '×',
                        '→',
                        '←',
                        // ordered step markers on /shhhhh's two-door section
                        '01',
                        '02',
                        ',',
                        '.',
                        '*',
                        '≈',
                        '≈ $',
                        'USD',
                        'R$',
                        'EVM',
                        'Solana',
                        'Tron',
                        // non-copy glyphs: card-number masks, percentages, decorative
                        // emoji, amount prefixes, and the brand URL stem
                        '****',
                        '••••',
                        '????',
                        '???? ???? ???? ????',
                        '??/??',
                        '100%',
                        '0%',
                        '120%',
                        '+$',
                        '✨',
                        '⭐',
                        'peanut.me/',
                        'i',
                        'version:',
                    ],
                },
            ],
        },
    },
]
