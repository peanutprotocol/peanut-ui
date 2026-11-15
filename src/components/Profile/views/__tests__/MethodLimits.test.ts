import { limitSummariesForRows } from '../MethodLimits'
import type { UnlockRow } from '@/utils/unlock-payments.utils'

const brlRow = { labelKey: 'brl', chip: 'active', limitRefs: ['BRL'] } as unknown as UnlockRow
const MANTECA_BRL = {
    exchangeCountry: 'BRA',
    type: 'EXCHANGE' as const,
    asset: 'BRL',
    yearlyLimit: '12000',
    availableYearlyLimit: '9000',
    monthlyLimit: '1000',
    availableMonthlyLimit: '800',
}
const ROOM = {
    currency: 'BRL',
    deposit: { brlLeft: '120000.00', usdLeft: '18500.00', blocked: false },
    payout: { brlLeft: '2000.00', usdLeft: '370.00', blocked: false },
}

describe('limitSummariesForRows: the BRL row shows the limits of the provider its Pix routes name', () => {
    it('shows Avenia’s monthly room, not Manteca’s BRL limit, when the routes name Avenia', () => {
        const summaries = limitSummariesForRows([brlRow], [MANTECA_BRL], null, 'en', { room: ROOM, deposits: true })
        expect(summaries).toEqual([{ kind: 'room', currency: 'BRL', deposit: ROOM.deposit, payout: ROOM.payout }])
    })

    it('leaves out Pix in for a user whose deposits are not Avenia’s', () => {
        const [summary] = limitSummariesForRows([brlRow], null, null, 'en', { room: ROOM, deposits: false })
        expect(summary).toMatchObject({ kind: 'room', deposit: undefined })
    })

    it('shows no BRL limit while Avenia’s room is unread, never Manteca’s stale one', () => {
        expect(limitSummariesForRows([brlRow], [MANTECA_BRL], null, 'en', { room: null, deposits: true })).toEqual([])
    })

    it('keeps Manteca’s BRL limit when the routes name Manteca', () => {
        expect(limitSummariesForRows([brlRow], [MANTECA_BRL], null, 'en')).toMatchObject([
            { kind: 'manteca', asset: 'BRL' },
        ])
    })
})
