import {
    classifySignupEntryFlow,
    resolveSignupEntryFlow,
    signupAnalyticsContext,
    captureSignupStepViewed,
    captureSignupControlUsed,
} from '@/features/setup/signup-analytics'
import posthog from 'posthog-js'

jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))

describe('classifySignupEntryFlow', () => {
    it.each([
        [null, 'default'],
        ['', 'default'],
        ['/home', 'default'],
        ['%2Fadd-money', 'add-money'],
        ['/add-money/us/bank', 'add-money'],
        ['/profile/accounts', 'identity-verification'],
        ['%2Fprofile%2Faccounts%2Fadditional', 'identity-verification'],
        ['/profile/payments', 'identity-verification'],
        // not a prefix match on the segment: /profile/accountsx is not the page
        ['/profile/accountsx', 'other'],
        // retired paths (old links/bookmarks) still bucket the same way
        ['/profile/accounts-and-payments', 'identity-verification'],
        ['%2Fprofile%2Faccounts-and-payments%2Fadditional', 'identity-verification'],
        ['/profile/identity-verification', 'identity-verification'],
        ['%2Fprofile%2Fidentity-verification%2Fadditional', 'identity-verification'],
        ['%2Fcard', 'card'],
        ['/card/add-to-wallet', 'card'],
        ['%2Fclaim%3Fstep%3Dclaim%26id%3Dabc', 'claim'],
        ['/claim/link-id', 'claim'],
        ['/receipt?id=abc', 'other'],
        ['https://attacker.example/card', 'other'],
        ['%E0%A4%A', 'other'],
    ])('classifies %p as %s', (redirectUri, expected) => {
        expect(classifySignupEntryFlow(redirectUri)).toBe(expected)
    })
})

describe('resolveSignupEntryFlow', () => {
    it('prefers an explicit redirect over stored state', () => {
        expect(
            resolveSignupEntryFlow('/card', {
                destination: '/claim?step=claim&id=payment-1',
                origin: 'deep-link',
            })
        ).toBe('card')
    })

    it('classifies an unconsumed stored deep-link on bare setup', () => {
        expect(resolveSignupEntryFlow(null, { destination: '/add-money/us/bank', origin: 'deep-link' })).toBe(
            'add-money'
        )
    })

    it('keeps a legacy unclassified redirect eligible during rollout', () => {
        expect(resolveSignupEntryFlow(null, { destination: '/claim?id=payment-1', origin: null })).toBe('claim')
    })

    it('does not attribute a previous session-end record to the new signup', () => {
        expect(resolveSignupEntryFlow(null, { destination: '/card', origin: 'session-end' })).toBe('default')
    })
})

describe('returning device signup context', () => {
    const markerKey = 'peanut-device-had-account'
    const analytics = jest.mocked(posthog)

    beforeEach(() => {
        jest.clearAllMocks()
        localStorage.clear()
        document.cookie = 'web-authn-key=; max-age=0; path=/'
    })

    it.each(['cookie', 'preferences'])('recognizes legacy passkey %s without a device marker', (source) => {
        const credential = { authenticatorId: 'legacy-passkey' }
        if (source === 'cookie') {
            document.cookie = `web-authn-key=${encodeURIComponent(JSON.stringify(credential))}; path=/`
        } else {
            localStorage.setItem('legacy-user:user-preferences', JSON.stringify({ webAuthnKey: credential }))
        }

        expect(localStorage.getItem(markerKey)).toBeNull()
        expect(signupAnalyticsContext('default')).toEqual({
            flow_version: 1,
            signup_entry_flow: 'default',
            returning_device: true,
        })
    })

    it.each(['default', 'add-money', 'identity-verification', 'card', 'claim', 'other'] as const)(
        'evaluates context for %s at each invocation',
        (entryFlow) => {
            expect(signupAnalyticsContext(entryFlow)).toEqual({
                flow_version: 1,
                signup_entry_flow: entryFlow,
                returning_device: false,
            })
            localStorage.setItem(markerKey, '1')
            expect(signupAnalyticsContext(entryFlow)).toEqual({
                flow_version: 1,
                signup_entry_flow: entryFlow,
                returning_device: true,
            })
        }
    )

    it('captures the status at each screen event', () => {
        const args = {
            screenId: 'welcome',
            stepIndex: 1,
            totalSteps: 3,
            navType: 'forward',
            signupEntryFlow: 'default',
        } as const
        captureSignupStepViewed(args)
        localStorage.setItem(markerKey, '1')
        captureSignupStepViewed(args)
        expect(analytics.capture).toHaveBeenNthCalledWith(1, 'signup_step_viewed', {
            screen_id: 'welcome',
            step_index: 1,
            total_steps: 3,
            nav_type: 'forward',
            flow_version: 1,
            signup_entry_flow: 'default',
            returning_device: false,
        })
        expect(analytics.capture).toHaveBeenNthCalledWith(2, 'signup_step_viewed', {
            screen_id: 'welcome',
            step_index: 1,
            total_steps: 3,
            nav_type: 'forward',
            flow_version: 1,
            signup_entry_flow: 'default',
            returning_device: true,
        })
    })

    it.each(['signup', 'verify-prelude'] as const)('captures control fields for host %s', (host) => {
        captureSignupControlUsed({
            screenId: 'welcome',
            control: 'continue',
            action: 'tap',
            value: 'chosen',
            host,
            signupEntryFlow: 'card',
        })
        expect(analytics.capture).toHaveBeenCalledWith('control_used', {
            flow: 'signup',
            screen_id: 'welcome',
            control: 'continue',
            action: 'tap',
            value: 'chosen',
            setup_host: host,
            flow_version: 1,
            signup_entry_flow: 'card',
            returning_device: false,
        })
    })

    it('omits value when no value is supplied', () => {
        captureSignupControlUsed({
            screenId: 'welcome',
            control: 'continue',
            action: 'tap',
            host: 'signup',
            signupEntryFlow: 'other',
        })
        expect(analytics.capture).toHaveBeenCalledWith('control_used', {
            flow: 'signup',
            screen_id: 'welcome',
            control: 'continue',
            action: 'tap',
            setup_host: 'signup',
            flow_version: 1,
            signup_entry_flow: 'other',
            returning_device: false,
        })
    })

    it('captures the status at each control event', () => {
        const args = {
            screenId: 'welcome',
            control: 'continue',
            action: 'tap',
            host: 'signup',
            signupEntryFlow: 'default',
        } as const
        captureSignupControlUsed(args)
        localStorage.setItem(markerKey, '1')
        captureSignupControlUsed(args)
        expect(analytics.capture).toHaveBeenNthCalledWith(1, 'control_used', {
            flow: 'signup',
            screen_id: 'welcome',
            control: 'continue',
            action: 'tap',
            setup_host: 'signup',
            flow_version: 1,
            signup_entry_flow: 'default',
            returning_device: false,
        })
        expect(analytics.capture).toHaveBeenNthCalledWith(2, 'control_used', {
            flow: 'signup',
            screen_id: 'welcome',
            control: 'continue',
            action: 'tap',
            setup_host: 'signup',
            flow_version: 1,
            signup_entry_flow: 'default',
            returning_device: true,
        })
    })
})
