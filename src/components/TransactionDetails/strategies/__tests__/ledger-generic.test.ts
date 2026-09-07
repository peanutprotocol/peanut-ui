/**
 * TASK-21817 — the ledger-bookkeeping strategies' role contracts.
 * CHARGEBACK direction follows the viewer's ledger entry (the mapper's
 * userRole), never a fixed sign.
 */
import { internalTransfer, chargeback } from '../intent/ledger-generic'
import { EHistoryUserRole, type HistoryEntry } from '@/hooks/useTransactionHistory'

const entry = (userRole: EHistoryUserRole): HistoryEntry =>
    ({ uuid: 'x', userRole, extraData: { kind: 'CHARGEBACK' } }) as unknown as HistoryEntry

describe('chargeback — direction follows the viewer entry', () => {
    it('a viewer on the CREDIT side (RECIPIENT) renders incoming', () => {
        const out = chargeback(entry(EHistoryUserRole.RECIPIENT))
        expect(out.direction).toBe('receive')
        expect(out.transactionCardType).toBe('receive')
    })

    it.each([EHistoryUserRole.SENDER, EHistoryUserRole.BOTH, EHistoryUserRole.NONE])(
        'role %s renders outgoing (the common clawback debit)',
        (role) => {
            const out = chargeback(entry(role))
            expect(out.direction).toBe('send')
            expect(out.transactionCardType).toBe('send')
        }
    )
})

describe('internalTransfer — neutral outgoing bookkeeping shape', () => {
    it('renders a send-shaped row with a generic name', () => {
        const out = internalTransfer(entry(EHistoryUserRole.SENDER))
        expect(out.direction).toBe('send')
        expect(out.nameForDetails).toBe('Internal transfer')
    })
})
