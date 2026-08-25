import { sanitizeUrl } from '@/utils/sentry.utils'

describe('sanitizeUrl — fetch-failure fingerprints', () => {
    it('collapses the enum values of a query param onto one fingerprint', () => {
        const iban = sanitizeUrl('https://api.peanut.me/bridge/exchange-rate?accountType=iban')
        const clabe = sanitizeUrl('https://api.peanut.me/bridge/exchange-rate?accountType=clabe')
        const gb = sanitizeUrl('https://api.peanut.me/bridge/exchange-rate?accountType=gb')

        expect(iban).toBe(clabe)
        expect(clabe).toBe(gb)
    })

    it('normalizes every value in a multi-param query', () => {
        expect(sanitizeUrl('https://api.peanut.me/manteca/prices?asset=USDC&against=ARS')).toBe(
            'https://api.peanut.me/manteca/prices?asset={value}&against={value}'
        )
    })

    /*
     * The numeric pass ran before this change, so its output has to stay
     * byte-identical — otherwise every already-correct fingerprint forks a new
     * Sentry issue on deploy and the existing history is orphaned.
     */
    it('leaves numeric query values on their existing {id} fingerprint', () => {
        expect(sanitizeUrl('https://api.peanut.me/users/history?limit=50')).toBe(
            'https://api.peanut.me/users/history?limit={id}'
        )
        expect(sanitizeUrl('https://api.peanut.me/users/history?limit=50')).toBe(
            sanitizeUrl('https://api.peanut.me/users/history?limit=5')
        )
    })

    it('still normalizes ids and uuids in the path', () => {
        expect(sanitizeUrl('https://api.peanut.me/rain/cards/123')).toBe('https://api.peanut.me/rain/cards/{id}')
        expect(sanitizeUrl('https://api.peanut.me/rain/cards/3f2b1a0c-4d5e-6f70-8912-a3b4c5d6e7f8/pin')).toBe(
            'https://api.peanut.me/rain/cards/{uuid}/pin'
        )
    })

    it('keeps different param names apart', () => {
        expect(sanitizeUrl('https://api.peanut.me/x?a=1')).not.toBe(sanitizeUrl('https://api.peanut.me/x?b=1'))
    })

    it('leaves a query-less url untouched', () => {
        expect(sanitizeUrl('https://api.peanut.me/users/limits')).toBe('https://api.peanut.me/users/limits')
    })

    it('mixes numeric and non-numeric values in one query', () => {
        expect(sanitizeUrl('https://api.peanut.me/tokens/price?address=0xaf88d065&chainId=42161')).toBe(
            'https://api.peanut.me/tokens/price?address={value}&chainId={id}'
        )
    })
})
