import messages from '@/i18n/app/messages/en.json'
import { instructionRows, type RailLabels } from '../instructionRows'
import { buildShareText } from '../shareText'
import type { DepositAccount, DepositRowLabels, DepositRules, SenderPolicy } from '../types'

const ROW_LABELS = messages.depositAccounts.rows as unknown as DepositRowLabels
const RAIL_LABELS = messages.depositAccounts.rows.rails as RailLabels

const account = (sender: SenderPolicy, rules?: DepositRules, over: Partial<DepositAccount> = {}): DepositAccount => ({
    id: 'a',
    railId: 'bridge.faster_payments_gb',
    country: 'GBR',
    currency: 'GBP',
    status: 'active',
    isPrimary: true,
    matching: { nameOnAccount: 'user', sender },
    ...(rules ? { rules } : {}),
    instructions: { accountHolderName: 'Ana Pérez', sortCode: '04-00-53', paymentRails: ['faster_payments'] },
    ...over,
})

const copy = {
    introOwn: 'Here are my bank details to get paid in GBP:',
    introPooled: 'Bank details to pay Ana in GBP:',
    outro: 'Sent from Peanut · peanut.me',
}

const text = (sender: SenderPolicy, rules?: DepositRules, over: Partial<DepositAccount> = {}) =>
    buildShareText(account(sender, rules, over), copy, ROW_LABELS, RAIL_LABELS)

/**
 * The copied text is the account fields and the footer, and nothing else. The
 * who-can-pay rules render on the holder's screen; they are deliberately kept
 * out of the message a payer pastes into a transfer form.
 */
describe('the shared text is the account fields and the footer', () => {
    it('carries the intro, the account numbers and the footer', () => {
        const out = text('anyone')
        expect(out).toContain('Here are my bank details to get paid in GBP:')
        expect(out).toContain('04-00-53')
        expect(out).toContain('Sent from Peanut · peanut.me')
    })

    it('keeps the who-can-pay rules out of the copied text', () => {
        const out = text('business-only', {
            ownAccount: { allowed: true },
            thirdPartyBusiness: 'unlimited',
            thirdPartyIndividual: { policy: 'unavailable' },
            min: { amount: '1', currency: 'EUR' },
        })
        // the rules the screen states must not travel with the numbers
        expect(out).not.toContain('From a business')
        expect(out).not.toContain('From another person')
        expect(out).not.toContain('own account')
        expect(out).not.toContain('Minimum deposit')
    })

    it('names a pooled account with the payer intro, never the possessive', () => {
        const out = text('anyone', undefined, { matching: { nameOnAccount: 'provider', sender: 'anyone' } })
        expect(out).toContain('Bank details to pay Ana in GBP:')
        expect(out).not.toContain('Here are my bank details')
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
        expect(rows.find((row) => row.key === 'accepts')?.value).toBe('Faster Payments')
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
