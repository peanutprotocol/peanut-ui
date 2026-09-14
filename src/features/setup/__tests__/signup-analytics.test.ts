import { classifySignupEntryFlow } from '@/features/setup/signup-analytics'

jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))

describe('classifySignupEntryFlow', () => {
    it.each([
        [null, 'default'],
        ['', 'default'],
        ['/home', 'default'],
        ['%2Fadd-money', 'add-money'],
        ['/add-money/us/bank', 'add-money'],
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
