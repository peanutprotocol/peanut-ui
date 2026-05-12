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

            // Project-specific: ban bare router.back() outside useSafeBack.
            // See src/hooks/useSafeBack.ts and PR #1965.
            'no-restricted-syntax': [
                'error',
                {
                    selector: "CallExpression[callee.object.name='router'][callee.property.name='back']",
                    message:
                        "Don't call router.back() directly — it no-ops on deep-link entries (cold tab, QR scan, push notification). Use useSafeBack(fallbackUrl) from '@/hooks/useSafeBack' instead. See PR #1965.",
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
]
