/** @jest-environment jsdom */
/*
 * 04 Invite unit checks from contract P2 (mono _temp/signup-redesign/r2/r9/build/contract/P2.md): P2-01, P2-09,
 * P2-34. Builder modules are loaded at test time, typed by the contract's API, so this file compiles before they
 * exist and each check fails on its own.
 */
import { setupSteps } from '@/components/Setup/Setup.consts'
import { InviteScreen } from '@/components/Setup/redesign/Invite/InviteScreen'

jest.mock('posthog-js', () => ({
    __esModule: true,
    default: { capture: jest.fn(), onFeatureFlags: jest.fn(() => () => {}), isFeatureEnabled: jest.fn(() => false) },
}))

/** contract P2 § 9 */
type InviteStepModule = {
    INVITE_CHECK_DEBOUNCE_MS: number
    shouldCheckInviter: (value: string) => boolean
}
const loadInviteStep = () => jest.requireActual<InviteStepModule>('@/features/setup/useInviteStep')
const loadFlagDefaults = () =>
    jest.requireActual<{ FLAG_DEFAULTS: Record<string, boolean> }>('@/utils/featureFlag.utils').FLAG_DEFAULTS

describe('04 Invite: order and gates', () => {
    it('P2-01 dev’s master order puts invite after signup and before passkey, rendered by InviteScreen', () => {
        const ids = setupSteps.map((step) => step.screenId)
        expect(ids.indexOf('invite')).toBe(ids.indexOf('signup') + 1)
        expect(ids.indexOf('passkey')).toBe(ids.indexOf('invite') + 1)
        const invite = setupSteps.find((step) => step.screenId === 'invite')
        expect(invite?.component).toBe(InviteScreen)
        expect(invite?.showBackButton).toBe(true)
    })

    it('P2-09 shouldCheckInviter needs 4 characters after normalising; the debounce is 750 ms', () => {
        const { INVITE_CHECK_DEBOUNCE_MS, shouldCheckInviter } = loadInviteStep()
        expect(shouldCheckInviter('abc')).toBe(false)
        expect(shouldCheckInviter('@Abc ')).toBe(false)
        expect(shouldCheckInviter('@Abcd ')).toBe(true)
        expect(INVITE_CHECK_DEBOUNCE_MS).toBe(750)
    })

    it('P2-34 the inviter-suggestions gate is registered and off by default (no-bypass read: see P2-35)', () => {
        expect(loadFlagDefaults()['signup-rollout-inviter-suggestions']).toBe(false)
    })
})
