import type { PasskeyHelpReason, SignupPasskey } from '@/features/setup/useSignupPasskey'
import { DeviceType } from '@/hooks/useGetDeviceType'

const noop = () => {}
const noopAsync = async () => {}

/**
 * A still useSignupPasskey state for the dev gallery: 03's help screens that only a phone reaches (a second
 * Android cancel, a timed-out or abandoned sheet, a pre-check that found no screen lock).
 */
export const previewPasskey = (
    helpReason: PasskeyHelpReason | null,
    overrides: Partial<SignupPasskey> = {}
): SignupPasskey => ({
    claim: noopAsync,
    isClaiming: false,
    preflightWarning: null,
    inlineError: null,
    inlineErrorCode: null,
    usernameTaken: false,
    logIn: noopAsync,
    isLoggingIn: false,
    recoveryDrawer: {
        visible: false,
        platform: DeviceType.ANDROID,
        onClose: noop,
        onRetry: noop,
        onSignUp: undefined,
        onSupport: noop,
    },
    helpErrorName: null,
    helpReason,
    isHelpOpen: helpReason !== null,
    closeHelp: noop,
    retryFromHelp: noop,
    openSettings: noop,
    isProviderUnsupportedOpen: false,
    providerUnsupportedPlatform: 'other',
    closeProviderUnsupported: noop,
    retryFromProviderUnsupported: noop,
    signUpInBrowser: noopAsync,
    deviceType: DeviceType.ANDROID,
    ...overrides,
})
