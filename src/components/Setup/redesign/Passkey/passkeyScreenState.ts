import type { PasskeyHelpReason } from '@/features/setup/useSignupPasskey'

export type PasskeyScreenState =
    | 'default'
    | 'prompt'
    | 'error-inline'
    | 'taken'
    | 'failed-android'
    | 'failed-ios'
    | 'cannot-create'
    | 'cannot-create-other'

/** The states that replace the hero with a full failure screen (Back closes them first). */
export const FAILED_STATES: readonly PasskeyScreenState[] = ['failed-android', 'failed-ios']
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
    if (input.isHelpOpen && input.helpReason === 'android-setup') return { state: 'failed-android', helpDrawer: false }
    if (input.isHelpOpen && input.helpReason === 'ios-not-saved') return { state: 'failed-ios', helpDrawer: false }
    if (input.isHelpOpen) return { state: 'default', helpDrawer: true }
    if (input.inlineError || input.preflightWarning) return { state: 'error-inline', helpDrawer: false }
    if (input.isClaiming) return { state: 'prompt', helpDrawer: false }
    return { state: 'default', helpDrawer: false }
}
