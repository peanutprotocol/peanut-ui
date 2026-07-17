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

// Barrel paths banned by CLAUDE.md ("no barrel imports — never `import * as X from
// '@/constants'` or create `index.ts` barrels. Import from specific files"). The bare
// alias resolves to `<dir>/index.{ts,tsx}` which forces the bundler to load every
// re-export, hurting build perf. Existing violations remain (~135 across the codebase)
// — the guard is preventative; cleanup belongs in a separate sweep.
const BANNED_BARREL_PATHS = ['@/constants', '@/components', '@/assets', '@/context', '@/interfaces', '@/config']

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

            // Ban barrel imports — see BANNED_BARREL_PATHS above.
            'no-restricted-imports': [
                'error',
                {
                    paths: BANNED_BARREL_PATHS.map((path) => ({
                        name: path,
                        message: `Import from a specific file instead of the '${path}' barrel — barrels force the bundler to load every re-export and hurt build perf. See CLAUDE.md.`,
                    })),
                },
            ],

            // Ban self-imports — CLAUDE.md import rules. Confirmed firing on synthetic test.
            'import-x/no-self-import': 'error',
            // import-x/no-cycle is intentionally NOT enabled. The plugin's no-cycle silently
            // fails on synthetic A↔B cycles under ESLint 9 flat config in this setup —
            // verified against both eslint-plugin-import 2.32 and eslint-plugin-import-x 4.16.
            // Self-imports are still caught above. Revisit when the plugin matures or someone
            // figures out the resolver gotcha.

            // Project-specific: catch the back-button bug class.
            // See src/hooks/useSafeBack.ts, PR #1965 (router.back), PR #1997 (sibling patterns).
            'no-restricted-syntax': [
                'error',
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
                    selector:
                        "CallExpression[callee.name=/^useQueryStates?$/] Property[key.name='history'][value.value='push']",
                    message:
                        "Don't pass { history: 'push' } to nuqs useQueryState(s) — a history entry per URL write breaks the back button (useSafeBack steps through same-screen states instead of leaving). Use the default 'replace'; the URL stays shareable. If a flow genuinely needs push-per-step, add a scoped file exemption with a comment (see useNativePlugins).",
                },
            ],
        },
    },
    {
        // The hook itself wraps router.back() — exempt.
        files: ['src/hooks/useSafeBack.ts', 'src/hooks/__tests__/useSafeBack.test.ts'],
        rules: { 'no-restricted-syntax': 'off' },
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
        files: ['src/components/Profile/components/PublicProfile.tsx'],
        rules: { 'no-restricted-syntax': 'off' },
    },
    {
        // require() inside test bodies is the Jest idiom for reading mocks after
        // jest.mock()/resetModules(); hoisting them to imports changes semantics.
        files: ['src/**/__tests__/**/*.{ts,tsx}', 'src/**/*.test.{ts,tsx}'],
        rules: { '@typescript-eslint/no-require-imports': 'off' },
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
            'src/components/{Home,Send,Request,Profile,Setup,Settings,Card,AddMoney,AddWithdraw,Withdraw,Claim,Payment,Points,Badges,Notifications,Invites,TransactionDetails,Kyc,IdentityVerification,ExchangeRate,Common,ForceIOSPWAInstall,User}/**/*.tsx',
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
            'src/components/Global/{PeanutLoading,Icons,Badges}/**',
            // InvitesGraph is a /dev-only debug visualization, not user-facing UI.
            'src/components/Global/InvitesGraph/**',
        ],
        rules: {
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
