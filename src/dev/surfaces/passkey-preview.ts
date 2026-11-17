import type { PasskeyHelpReason, SignupPasskey } from '@/features/setup/useSignupPasskey'

const noop = () => {}
const noopAsync = async () => {}

/**
 * A still useSignupPasskey state for the dev gallery: 03's help screens that only a phone reaches (a second
 * Android cancel, a timed-out or abandoned sheet, a pre-check that found no screen lock).
 */
export const previewPasskey = (helpReason: PasskeyHelpReason): SignupPasskey => ({
    claim: noopAsync,
    isClaiming: false,
    preflightWarning: null,
    inlineError: null,
    inlineErrorCode: null,
    usernameTaken: false,
    logIn: noopAsync,
    isLoggingIn: false,
    helpErrorName: null,
    helpReason,
    isHelpOpen: true,
    closeHelp: noop,
    retryFromHelp: noop,
    openSettings: noop,
    isProviderUnsupportedOpen: false,
    providerUnsupportedPlatform: 'other',
    closeProviderUnsupported: noop,
    retryFromProviderUnsupported: noop,
    signUpInBrowser: noopAsync,
    deviceType: 'android',
})
