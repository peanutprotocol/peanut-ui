// ESLint flat config for peanut-ui (Next 16 / React 19 / TypeScript).
// Baseline rules: TypeScript recommended, React recommended, React Hooks, Next.js.
// Plus a project-specific rule banning bare router.back() outside useSafeBack (PR #1965).

const tsParser = require('@typescript-eslint/parser')
const tsPlugin = require('@typescript-eslint/eslint-plugin')
const reactPlugin = require('eslint-plugin-react')
const reactHooksPlugin = require('eslint-plugin-react-hooks')
const nextPlugin = require('@next/eslint-plugin-next')
const globals = require('globals')

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
        },
        settings: { react: { version: 'detect' } },
        rules: {
            ...tsPlugin.configs.recommended.rules,
            ...reactPlugin.configs.recommended.rules,
            ...reactHooksPlugin.configs.recommended.rules,
            ...nextPlugin.configs.recommended.rules,
            ...nextPlugin.configs['core-web-vitals'].rules,

            // React 17+ — no need to import React for JSX
            'react/react-in-jsx-scope': 'off',
            'react/jsx-uses-react': 'off',
            // We use TypeScript for prop validation
            'react/prop-types': 'off',
            // Allow unescaped quotes — too noisy and prettier handles spacing
            'react/no-unescaped-entities': 'off',

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
                        "Bare router.push/replace as onPrev/onBack creates a parent↔child cycle once the parent uses useSafeBack (the push grows in-app history, useSafeBack pops back to this screen, repeat). Use useSafeBack(parentUrl) — pass { replace: true } to preserve replace semantics. See PR #1997.",
                },
                {
                    selector:
                        "MemberExpression[object.object.name='window'][object.property.name='history'][property.name='length']",
                    message:
                        "window.history.length is the pre-useSafeBack idiom (history.length > 1 ? back : push). It misfires on cold-load from external referrers — useSafeBack's pushState counter is more accurate. See PR #1965.",
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
]
