import { EHistoryUserRole } from '@/hooks/useTransactionHistory'
import type { TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'
import { getCancelDepositKind } from '../cancel-deposit.utils'

const tx = (fields: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
    ({ status: 'pending', ...fields, extraDataForDrawer: extra }) as unknown as TransactionDetails

describe('getCancelDepositKind', () => {
    it('pending bridge onramp with deposit instructions → bridge-onramp', () => {
        const t = tx({ direction: 'bank_deposit' }, { kind: 'ONRAMP', depositInstructions: {} })
        expect(getCancelDepositKind(t, false)).toBe('bridge-onramp')
    })

    it('bridge onramp without deposit instructions is not cancellable', () => {
        expect(getCancelDepositKind(tx({ direction: 'bank_deposit' }, { kind: 'ONRAMP' }), false)).toBeNull()
    })

    it('a completed deposit is not cancellable', () => {
        const t = tx({ direction: 'bank_deposit', status: 'completed' }, { kind: 'ONRAMP', depositInstructions: {} })
        expect(getCancelDepositKind(t, false)).toBeNull()
    })

    it('pending manteca onramp → manteca-onramp', () => {
        const t = tx({ direction: 'bank_deposit' }, { kind: 'ONRAMP', provider: 'MANTECA' })
        expect(getCancelDepositKind(t, false)).toBe('manteca-onramp')
    })

    it('request rows skip the bridge branch; sender of a pending bank request → bank-request', () => {
        const t = tx(
            { direction: 'bank_deposit' },
            { kind: 'P2P_REQUEST_FULFILL', depositInstructions: {}, originalUserRole: EHistoryUserRole.SENDER }
        )
        expect(getCancelDepositKind(t, false)).toBeNull()
        expect(getCancelDepositKind(t, true)).toBe('bank-request')
    })

    it('the recipient of a pending bank request cannot cancel it', () => {
        const t = tx({}, { kind: 'P2P_REQUEST_FULFILL', originalUserRole: EHistoryUserRole.RECIPIENT })
        expect(getCancelDepositKind(t, true)).toBeNull()
    })
})
