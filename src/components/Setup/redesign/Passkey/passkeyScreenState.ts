import type { PasskeyHelpReason } from '@/features/setup/useSignupPasskey'

export type PasskeyScreenState =
    | 'default'
    | 'prompt'
    | 'error-inline'
    | 'taken'
    | 'failed-android'
    | 'failed-ios'
    | 'second-cancel'
    | 'took-too-long'
    | 'left-app'
    | 'check-screen-lock'
    | 'check-no-provider'
    | 'cannot-create'
    | 'cannot-create-other'

/** The help reasons the redesign draws as a full failure screen instead of dev's drawer. */
const HELP_SCREENS: Partial<Record<PasskeyHelpReason, PasskeyScreenState>> = {
    'android-setup': 'failed-android',
    'ios-not-saved': 'failed-ios',
    'android-cancel': 'second-cancel',
    'took-too-long': 'took-too-long',
    'left-app': 'left-app',
    'screen-lock': 'check-screen-lock',
    'no-provider': 'check-no-provider',
}

/** The states that replace the hero with a full failure screen (Back closes them first). */
export const FAILED_STATES: readonly PasskeyScreenState[] = Object.values(HELP_SCREENS)
export const CANNOT_STATES: readonly PasskeyScreenState[] = ['cannot-create', 'cannot-create-other']

export type PasskeyScreenInput = {
    usernameTaken: boolean
    isProviderUnsupportedOpen: boolean
    providerUnsupportedPlatform: 'android-app' | 'other'
    isHelpOpen: boolean
    helpReason: PasskeyHelpReason | null
    inlineError: string | null
    preflightWarning: string | null
    isClaiming: boolean
}

/**
 * The 03 state from useSignupPasskey's fields, with the contract's precedence (C.md § 3.2): taken, then can't
 * save, then the failed screens, then dev's help drawer over the hero, then the inline error, then the prompt.
 * `helpDrawer` = dev's PasskeySetupHelpDrawer shows over the default hero.
 */
export function passkeyScreenState(input: PasskeyScreenInput): { state: PasskeyScreenState; helpDrawer: boolean } {
    if (input.usernameTaken) return { state: 'taken', helpDrawer: false }
    if (input.isProviderUnsupportedOpen)
        return {
            state: input.providerUnsupportedPlatform === 'android-app' ? 'cannot-create' : 'cannot-create-other',
            helpDrawer: false,
        }
    const helpScreen = input.isHelpOpen && input.helpReason ? HELP_SCREENS[input.helpReason] : undefined
    if (helpScreen) return { state: helpScreen, helpDrawer: false }
    if (input.isHelpOpen) return { state: 'default', helpDrawer: true }
    if (input.inlineError || input.preflightWarning) return { state: 'error-inline', helpDrawer: false }
    if (input.isClaiming) return { state: 'prompt', helpDrawer: false }
    return { state: 'default', helpDrawer: false }
}
