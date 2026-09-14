import type { ScreenId } from './Setup.types'

/**
 * The complete setup screen order without importing any screen components.
 *
 * Keep this module dependency-free at runtime: setup screen components use
 * `useSetupFlow`, while the component-backed setup config imports those same
 * components. The flow hook only needs the IDs for its initial placeholder
 * list, so importing the full config there creates a client-side module cycle.
 */
export const SETUP_SCREEN_IDS = [
    'unsupported-browser',
    'android-initial-pwa-install',
    'pwa-install',
    'landing',
    'welcome',
    'signup',
    'residence',
    'passkey-permission',
    'sign-test-transaction',
] as const satisfies readonly ScreenId[]
