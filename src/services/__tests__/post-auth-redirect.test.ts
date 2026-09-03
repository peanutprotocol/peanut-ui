import { consumePostAuthRedirect } from '../post-auth-redirect'
import { getRedirectUrl, saveToLocalStorage } from '@/utils/general.utils'

const FINANCIAL_REDIRECT = '/claim?step=claim&id=payment-1'
const CAMPAIGN_REDIRECT = '/add-money/crypto?network=EVM'

describe('post-auth redirect consumption', () => {
    beforeEach(() => localStorage.clear())

    it('discards a lower-priority campaign destination when an explicit financial continuation wins', () => {
        saveToLocalStorage('redirect', CAMPAIGN_REDIRECT)

        expect(consumePostAuthRedirect(FINANCIAL_REDIRECT)).toEqual({
            destination: FINANCIAL_REDIRECT,
            source: 'explicit',
            deferred: false,
        })
        expect(getRedirectUrl()).toBeNull()

        // A later login cannot resurrect the superseded campaign journey.
        expect(consumePostAuthRedirect(null)).toEqual({
            destination: '/home',
            source: 'fallback',
            deferred: false,
        })
    })

    it('also consumes stored state when a malformed explicit redirect falls back safely', () => {
        saveToLocalStorage('redirect', CAMPAIGN_REDIRECT)

        expect(consumePostAuthRedirect('https://attacker.example/claim')).toEqual({
            destination: '/home',
            source: 'explicit',
            deferred: false,
        })
        expect(getRedirectUrl()).toBeNull()
    })

    it('consumes a confirmed published campaign destination exactly once', () => {
        saveToLocalStorage('redirect', CAMPAIGN_REDIRECT)

        expect(consumePostAuthRedirect(null)).toEqual({
            destination: CAMPAIGN_REDIRECT,
            source: 'stored',
            deferred: false,
        })
        expect(getRedirectUrl()).toBeNull()
    })

    it('can deliberately retain a safe stored continuation for a post-signup action', () => {
        saveToLocalStorage('redirect', FINANCIAL_REDIRECT)

        expect(
            consumePostAuthRedirect(null, {
                deferStoredRedirect: (destination) => destination.includes('/claim'),
            })
        ).toEqual({ destination: '/home', source: 'stored', deferred: true })
        expect(getRedirectUrl()).toBe(FINANCIAL_REDIRECT)
    })

    it('never defers an unsafe stored URL merely because its text matches the predicate', () => {
        saveToLocalStorage('redirect', 'https://attacker.example/claim')

        expect(
            consumePostAuthRedirect(null, {
                deferStoredRedirect: (destination) => destination.includes('/claim'),
            })
        ).toEqual({ destination: '/home', source: 'stored', deferred: false })
        expect(getRedirectUrl()).toBeNull()
    })
})
