import messages from '@/i18n/app/messages/en.json'
import { t } from '@/i18n/interpolate'
import { instructionRows, type RailLabels } from '../instructionRows'
import { depositRuleLines } from '../ruleLines'
import { buildShareText } from '../shareText'
import type { DepositAccount, DepositRowLabels, DepositRules, SenderPolicy } from '../types'

const ROW_LABELS = messages.depositAccounts.rows as unknown as DepositRowLabels
const RAIL_LABELS = messages.depositAccounts.rows.rails as RailLabels
const RULES = messages.depositAccounts.rules

const money = (amount: string, currency: string) => `${currency} ${amount}`

/** the same resolver the screens use, with the catalog they read */
const payerLines = (account: DepositAccount, user: string) =>
    depositRuleLines(account.matching, account.rules, money).map(({ key, values }) =>
        t(RULES[key].payer, { user, ...values })
    )

const account = (sender: SenderPolicy, rules?: DepositRules, over: Partial<DepositAccount> = {}): DepositAccount => ({
    id: 'a',
    railId: 'bridge.faster_payments_gb',
    country: 'GBR',
    currency: 'GBP',
    status: 'active',
    isPrimary: true,
    matching: { nameOnAccount: 'user', sender, memo: 'none', amount: 'flexible' },
    ...(rules ? { rules } : {}),
    instructions: { accountHolderName: 'Ana Pérez', sortCode: '04-00-53', paymentRails: ['faster_payments'] },
    ...over,
})

const text = (sender: SenderPolicy, rules?: DepositRules) => {
    const acc = account(sender, rules)
    return buildShareText(
        acc,
        {
            introOwn: 'Here are my bank details to get paid in GBP:',
            introPooled: 'Bank details to pay Ana in GBP:',
            rules: payerLines(acc, 'Ana Pérez'),
            outro: 'Sent from Peanut · peanut.me',
        },
        ROW_LABELS,
        RAIL_LABELS
    )
}

/**
 * The in-app screen can say who may pay in beside the details. The copied text
 * cannot — it is read in a payroll inbox with no Peanut screen anywhere near
 * it. So the rules travel with the numbers, or the payer learns them when
 * their transfer comes back weeks later.
 */
describe('the shared text carries the account rules', () => {
    it('tells a GBP payer that only a business may pay', () => {
        expect(text('business-only')).toContain('Only a business can pay into this account')
    })

    it('states the euro terms the backend published, and no more', () => {
        const out = text('business-only', {
            businessesUnlimited: true,
            individualsAllowed: false,
            min: { amount: '1', currency: 'EUR' },
        })
        expect(out).toContain('A business can pay any amount')
        expect(out).toContain('Please pay from a company account')
        expect(out).toContain('The smallest payment is EUR 1')
        // the published terms replace the generic restriction sentence
        expect(out).not.toContain('Only a business can pay into this account')
    })

    it('gives a dollar payer the cap and the exemptions', () => {
        const out = text('anyone', {
            individualPerPaymentCap: { amount: '4000', currency: 'USD' },
            familySameSurnameExempt: true,
            businessesUnlimited: true,
        })
        expect(out).toContain('up to USD 4000 in one payment')
        expect(out).toContain('Family who share the account holder surname')
    })

    it('warns the payer where nothing is published, rather than going quiet', () => {
        const out = text('unknown')
        expect(out).toContain('04-00-53')
        expect(out).toContain('Any amount, and no reference to remember')
        // the text is read by somebody who will never see a Peanut screen, so
        // the one thing we cannot promise has to travel with the numbers
        expect(out).toContain('not confirmed on this currency yet')
        expect(out).toContain('may be sent back')
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
