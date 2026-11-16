import { limitSummariesForRows } from '../MethodLimits'
import type { UnlockRow } from '@/utils/unlock-payments.utils'
import type { RailOperation } from '@/types/capabilities'

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
    currency: 'BRL' as const,
    deposit: { brlLeft: '120000.00', usdLeft: '18500.00', blocked: false },
    payout: { brlLeft: '2000.00', usdLeft: '370.00', blocked: false },
}

describe('limitSummariesForRows: the BRL row shows the limits of the provider its Pix routes name', () => {
    const ALL: RailOperation[] = ['deposit', 'withdraw', 'pay']

    it('shows Avenia’s monthly room, not Manteca’s BRL limit, when every route names Avenia', () => {
        const summaries = limitSummariesForRows([brlRow], [MANTECA_BRL], null, 'en', {
            room: ROOM,
            operations: ALL,
            mantecaToo: false,
        })
        expect(summaries).toEqual([{ kind: 'room', currency: 'BRL', room: ROOM, operations: ALL }])
    })

    // review 2, finding 5: a QR payment outside Avenia's QR gate stays under Manteca's limit
    it('shows Manteca’s BRL limit beside Avenia’s room while Manteca still serves an operation', () => {
        const summaries = limitSummariesForRows([brlRow], [MANTECA_BRL], null, 'en', {
            room: ROOM,
            operations: ['deposit', 'withdraw'],
            mantecaToo: true,
        })
        expect(summaries).toMatchObject([
            { kind: 'room', operations: ['deposit', 'withdraw'] },
            { kind: 'manteca', asset: 'BRL' },
        ])
    })

    it('shows no BRL limit while Avenia’s room is unread, never Manteca’s stale one', () => {
        expect(
            limitSummariesForRows([brlRow], [MANTECA_BRL], null, 'en', {
                room: null,
                operations: ALL,
                mantecaToo: false,
            })
        ).toEqual([])
    })

    it('keeps Manteca’s BRL limit when the routes name Manteca', () => {
        expect(limitSummariesForRows([brlRow], [MANTECA_BRL], null, 'en')).toMatchObject([
            { kind: 'manteca', asset: 'BRL' },
        ])
    })
})
