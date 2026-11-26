import type { IUserProfile } from '@/interfaces/interfaces'
import { unfinishedSignupRoute } from '../unfinished-signup'

const RECENT = '2026-11-20T10:00:00.000Z'
const WALLET = [{ type: 'peanut-wallet' }]

const profile = (
    user: { username?: string | null; email?: string; createdAt?: string },
    accounts: { type: string }[] = []
) => ({ user: { createdAt: RECENT, ...user }, accounts }) as unknown as IUserProfile

describe('unfinishedSignupRoute', () => {
    it('is null once the last step created the wallet and the email is saved', () => {
        expect(unfinishedSignupRoute(profile({ username: 'alice', email: 'alice@example.com' }, WALLET))).toBeNull()
    })

    it('walks the steps again when the email was never given', () => {
        expect(unfinishedSignupRoute(profile({ username: 'test044', email: '' }))).toBe('/setup')
    })

    // The payment choices and notification step after the email are saved nowhere until the wallet step.
    it('walks the steps again after the email was saved too', () => {
        expect(unfinishedSignupRoute(profile({ username: 'alice', email: 'alice@example.com' }))).toBe('/setup')
    })

    it('sends an account /setup cannot resume, one without a username, to the wallet step', () => {
        expect(unfinishedSignupRoute(profile({ username: null, email: '' }))).toBe('/setup/finish')
    })

    it('ignores accounts that are not the Peanut wallet', () => {
        expect(unfinishedSignupRoute(profile({ username: 'alice', email: '' }, [{ type: 'iban' }]))).toBe('/setup')
    })

    // TASK-25379: the email step once let a dormant holder's address through unsaved.
    it.each([
        ['an empty email', ''],
        ['a blank email', '   '],
        ['no email field', undefined],
    ])('sends a wallet with %s back to /setup', (_label, email) => {
        expect(unfinishedSignupRoute(profile({ username: 'alice', email }, WALLET))).toBe('/setup')
    })

    it('counts an account made the moment the email step became required', () => {
        const createdAt = '2026-10-07T11:16:09.000Z'
        expect(unfinishedSignupRoute(profile({ username: 'alice', email: '', createdAt }, WALLET))).toBe('/setup')
    })

    it('leaves a wallet without an email alone when the account is older than the required email step', () => {
        const createdAt = '2026-10-07T11:16:08.000Z'
        expect(unfinishedSignupRoute(profile({ username: 'alice', email: '', createdAt }, WALLET))).toBeNull()
    })

    // /setup/finish only creates a wallet; sending a wallet holder there would bounce it home and back.
    it('leaves a wallet without a username or an email alone', () => {
        expect(unfinishedSignupRoute(profile({ username: null, email: '' }, WALLET))).toBeNull()
    })
})
