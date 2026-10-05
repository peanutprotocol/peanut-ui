import { bridgeProviderIdForResidence, providerIdForTransaction } from '../provider.utils'
import type { TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'

const tx = (provider: string | undefined, code?: string) =>
    ({
        extraDataForDrawer: provider ? { provider } : undefined,
        currency: code ? { amount: '1', code } : undefined,
    }) as Pick<TransactionDetails, 'extraDataForDrawer' | 'currency'>

describe('bridgeProviderIdForResidence', () => {
    it.each([
        ['US', 'bridge-us'],
        ['us', 'bridge-us'],
        ['DE', 'bridge-eea'],
        ['NO', 'bridge-eea'],
        ['MX', 'bridge-row'],
        ['AR', 'bridge-row'],
        ['GB', 'bridge'],
        ['gb', 'bridge'],
        ['MC', 'bridge'],
        [null, 'bridge'],
        [undefined, 'bridge'],
        ['', 'bridge'],
    ])('maps %s to %s', (iso2, id) => {
        expect(bridgeProviderIdForResidence(iso2)).toBe(id)
    })
})

describe('providerIdForTransaction', () => {
    it('maps bridge by residence', () => {
        expect(providerIdForTransaction(tx('BRIDGE'), 'US')).toBe('bridge-us')
        expect(providerIdForTransaction(tx('BRIDGE'), 'FR')).toBe('bridge-eea')
        expect(providerIdForTransaction(tx('BRIDGE'))).toBe('bridge')
    })

    it('maps manteca by currency', () => {
        expect(providerIdForTransaction(tx('MANTECA', 'ARS'))).toBe('manteca-ar')
        expect(providerIdForTransaction(tx('MANTECA', 'brl'))).toBe('manteca-br')
        expect(providerIdForTransaction(tx('MANTECA', 'USD'))).toBeNull()
        expect(providerIdForTransaction(tx('MANTECA'))).toBeNull()
    })

    it('maps rain and rhino', () => {
        expect(providerIdForTransaction(tx('RAIN'))).toBe('third-national')
        expect(providerIdForTransaction(tx('RHINO'))).toBe('rhino')
    })

    it.each(['PEANUT', 'ONCHAIN', 'DEPRECATED_SQUID', undefined])('shows no provider for %s', (provider) => {
        expect(providerIdForTransaction(tx(provider))).toBeNull()
    })
})
