import messages from '@/i18n/app/messages/en.json'
import { instructionRows, type RailLabels } from '../instructionRows'
import { buildShareText } from '../shareText'
import type { DepositAccount, DepositRowLabels, SenderPolicy } from '../types'

const ROW_LABELS = messages.depositAccounts.rows as unknown as DepositRowLabels
const RAIL_LABELS = messages.depositAccounts.rows.rails as RailLabels
const SENDER_NOTES: Partial<Record<SenderPolicy, string>> = {
    'business-only': messages.depositAccounts.share.textSender['business-only'],
    unknown: messages.depositAccounts.share.textSender.unknown,
}

const account = (sender: SenderPolicy): DepositAccount => ({
    id: 'a',
    railId: 'bridge.faster_payments_gb',
    country: 'GBR',
    currency: 'GBP',
    status: 'active',
    isPrimary: true,
    matching: { nameOnAccount: 'user', sender, memo: 'none', amount: 'flexible' },
    instructions: { accountHolderName: 'Ana Pérez', sortCode: '04-00-53', paymentRails: ['faster_payments'] },
})

const text = (sender: SenderPolicy) =>
    buildShareText(
        account(sender),
        {
            introOwn: 'Here are my bank details to get paid in GBP:',
            introPooled: 'Bank details to pay Ana in GBP:',
            senderNotes: SENDER_NOTES,
            outro: 'Sent from Peanut · peanut.me',
        },
        ROW_LABELS,
        RAIL_LABELS
    )

/**
 * The in-app screen can say who may pay in beside the details. The copied text
 * cannot — it is read in a payroll inbox with no Peanut screen anywhere near
 * it. So the rule travels with the numbers, or the payer learns it when their
 * transfer comes back weeks later.
 */
describe('the shared text carries the sender rule', () => {
    it('tells a GBP payer that only a company may pay', () => {
        expect(text('business-only')).toContain('Only a company can pay into this account')
    })

    it('warns on an unproved corridor without withholding the details', () => {
        const out = text('unknown')
        expect(out).toContain('04-00-53')
        expect(out).toContain('not yet confirmed')
    })

    it('says nothing extra where anyone may pay', () => {
        const out = text('anyone')
        expect(out).not.toContain('Only a company')
        expect(out).not.toContain('not yet confirmed')
    })
})

/**
 * The "Accepts" row names rails, and it used to name them in English in every
 * locale — a Spanish details card reading `Bank transfer`, or worse the raw
 * `transfer_ar`.
 */
describe('rail names on the details card', () => {
    it('comes from the catalog, never from the provider id', () => {
        const rows = instructionRows(account('anyone').instructions!, ROW_LABELS, RAIL_LABELS)
        const accepts = rows.find((row) => row.key === 'accepts')
        expect(accepts?.value).toBe('Faster Payments')
    })

    it('falls back to true generic wording for a rail we do not know', () => {
        const rows = instructionRows(
            { accountHolderName: 'Ana Pérez', paymentRails: ['some_new_bridge_rail'] },
            ROW_LABELS,
            RAIL_LABELS
        )
        const accepts = rows.find((row) => row.key === 'accepts')
        expect(accepts?.value).toBe('Bank transfer')
        expect(accepts?.value).not.toContain('_')
    })
})
