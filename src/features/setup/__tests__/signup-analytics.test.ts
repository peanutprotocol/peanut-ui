import { classifySignupEntryFlow, resolveSignupEntryFlow } from '@/features/setup/signup-analytics'

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
