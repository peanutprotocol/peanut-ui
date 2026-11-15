// A deposit is named by its method, not its provider (Aleks, 2026-11-15): a Pix deposit reads
// "Added by Pix" through Avenia and Manteca alike; a bank deposit keeps "Bank account".
import { fiatOnramp } from '../intent/fiat-onramp'
import { TRANSACTION_NAME_KEYS } from '../../transaction-name-keys'
import { type HistoryEntry } from '@/utils/history.utils'

const deposit = (provider: string, code: string, extraData: Record<string, unknown> = {}): HistoryEntry =>
    ({
        amount: '3.32',
        currency: { code, amount: '20' },
        extraData: { provider, ...extraData },
    }) as unknown as HistoryEntry

describe('fiatOnramp names the deposit by its method', () => {
    it.each([
        ['AVENIA', 'BRL'],
        ['MANTECA', 'BRL'],
        ['BRIDGE', 'brl'],
    ])('a Pix deposit through %s (%s) is named Pix', (provider, code) => {
        const out = fiatOnramp(deposit(provider, code))
        expect(out.nameKey).toBe(TRANSACTION_NAME_KEYS.pix)
        expect(out.nameForDetails).toBe('Pix')
        expect(out.direction).toBe('bank_deposit')
    })

    it.each([
        ['BRIDGE', 'EUR'],
        ['BRIDGE', 'USD'],
        ['BRIDGE', 'MXN'],
        ['MANTECA', 'ARS'],
    ])('a bank deposit through %s (%s) keeps Bank account', (provider, code) => {
        const out = fiatOnramp(deposit(provider, code))
        expect(out.nameKey).toBe(TRANSACTION_NAME_KEYS.bankAccount)
        expect(out.nameForDetails).toBe('Bank Account')
    })

    it('an expired Manteca deposit order still says so', () => {
        const out = fiatOnramp(deposit('MANTECA', 'BRL', { mantecaDepositExpired: true }))
        expect(out.nameKey).toBe(TRANSACTION_NAME_KEYS.depositOrderExpired)
    })
})
