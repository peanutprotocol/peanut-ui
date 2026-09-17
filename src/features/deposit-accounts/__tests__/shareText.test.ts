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
    matching: { nameOnAccount: 'user', sender },
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
    it('answers every payer, so the holder never has to', () => {
        const out = text('business-only')
        expect(out).toContain("From the account holder's own account: yes")
        expect(out).toContain('From a business: any amount')
        expect(out).toContain('From another person: not yet')
    })

    it('states the euro terms the backend published, and no more', () => {
        const out = text('business-only', {
            ownAccount: { allowed: true },
            thirdPartyBusiness: 'unlimited',
            thirdPartyIndividual: { policy: 'unavailable' },
            min: { amount: '1', currency: 'EUR' },
        })
        expect(out).toContain('From a business: any amount')
        expect(out).toContain('From another person: not yet')
        expect(out).toContain('Minimum deposit: EUR 1')
    })

    it('gives a dollar payer the cap as a strict limit, and the exemptions', () => {
        const out = text('anyone', {
            ownAccount: { allowed: true },
            thirdPartyBusiness: 'unlimited',
            thirdPartyIndividual: {
                policy: 'capped',
                capBelow: { amount: '4000', currency: 'USD' },
                familySameSurnameExempt: true,
            },
        })
        expect(out).toContain('less than USD 4000 each time')
        expect(out).not.toContain('up to USD 4000')
        expect(out).toContain('Family who share the account holder surname: any amount')
    })

    it('sends the peso volume limit out with the numbers, period and all', () => {
        const out = text('anyone', {
            ownAccount: { allowed: true, max: { amount: '1000000', currency: 'MXN' } },
            thirdPartyBusiness: 'unlimited',
            thirdPartyIndividual: { policy: 'capped', volumeLimit: { amount: '15000', currency: 'MXN' } },
        })
        expect(out).toContain("From the account holder's own account: up to MXN 1000000")
        expect(out).toContain('up to MXN 15000 in total')
        // a volume limit is not a per-payment cap, and the text must not read as one
        expect(out).not.toContain('less than MXN 15000')
    })

    it('warns the payer where nothing is published, rather than going quiet', () => {
        const out = text('unknown')
        expect(out).toContain('04-00-53')
        // the text is read by somebody who will never see a Peanut screen, so
        // the one thing we cannot promise has to travel with the numbers
        expect(out).toContain('From a business: not confirmed')
        expect(out).toContain('From another person: not confirmed. The transfer may be returned.')
        expect(out).toContain('From a business: not confirmed. The transfer may be returned.')
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
