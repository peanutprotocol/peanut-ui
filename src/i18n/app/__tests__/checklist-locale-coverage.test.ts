import { APP_LOCALES } from '../config'
import { loadMessages } from '../messages'

/**
 * Every string GettingStartedChecklist renders, resolved through the real
 * loader, for every locale.
 *
 * es-AR is a deltas-only file layered over es-419, so a key it does not
 * restate is not a missing key — but "it inherits" is a claim worth executing
 * rather than asserting. Review has twice read the es-AR diff alone and
 * concluded these were missing.
 */
const CHECKLIST_KEYS = [
    'title',
    'createAccount',
    'createAccountDone',
    'addMoney',
    'addMoneyRoutes',
    'addMoneyRoutesKyc',
    'getCard',
    'getCardNote',
    'firstPayment',
    'firstPaymentNote',
] as const

describe('getting-started checklist copy resolves in every locale', () => {
    it.each(APP_LOCALES.map((locale) => [locale]))('%s', async (locale) => {
        const messages = await loadMessages(locale)
        const gettingStarted = (messages as unknown as Record<string, any>).home.gettingStarted

        for (const key of CHECKLIST_KEYS) {
            expect(typeof gettingStarted[key]).toBe('string')
            expect(gettingStarted[key].length).toBeGreaterThan(0)
            // a raw key path leaking through as copy is the failure mode here
            expect(gettingStarted[key]).not.toContain('gettingStarted.')
        }
    })

    it('es-AR inherits the keys it does not restate, rather than losing them', async () => {
        const esAR = (await loadMessages('es-AR')) as unknown as Record<string, any>
        const es419 = (await loadMessages('es-419')) as unknown as Record<string, any>

        expect(esAR.home.gettingStarted.addMoneyRoutes).toBe(es419.home.gettingStarted.addMoneyRoutes)
        expect(esAR.home.gettingStarted.getCardNote).toBe(es419.home.gettingStarted.getCardNote)
        // and its own delta still wins where it does restate one
        expect(esAR.home.gettingStarted.addMoneyRoutesKyc).not.toBe(es419.home.gettingStarted.addMoneyRoutesKyc)
    })
})
