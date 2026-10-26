import type { IUserProfile } from '@/interfaces/interfaces'
import { unfinishedSignupRoute } from '../unfinished-signup'

const profile = (user: { username?: string | null; email?: string }, accounts: { type: string }[] = []) =>
    ({ user, accounts }) as unknown as IUserProfile

describe('unfinishedSignupRoute', () => {
    it('is null once the last step created the wallet', () => {
        expect(unfinishedSignupRoute(profile({ username: 'alice' }, [{ type: 'peanut-wallet' }]))).toBeNull()
    })

    it('walks the steps again when the email was never given', () => {
        expect(unfinishedSignupRoute(profile({ username: 'test044', email: '' }))).toBe('/setup')
    })

    it('only creates the wallet once the email is there', () => {
        expect(unfinishedSignupRoute(profile({ username: 'alice', email: 'alice@example.com' }))).toBe('/setup/finish')
    })

    it('sends an account /setup cannot resume, one without a username, to the wallet step', () => {
        expect(unfinishedSignupRoute(profile({ username: null, email: '' }))).toBe('/setup/finish')
    })

    it('ignores accounts that are not the Peanut wallet', () => {
        expect(unfinishedSignupRoute(profile({ username: 'alice', email: '' }, [{ type: 'iban' }]))).toBe('/setup')
    })
})
