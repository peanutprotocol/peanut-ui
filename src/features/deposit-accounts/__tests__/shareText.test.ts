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
    payerLine: { 'business-only': 'Pay from a business account.', unknown: 'A transfer may be returned.' },
    referenceLine: 'Add the reference to every transfer.',
    eurOwnNameLine: 'A euro transfer from another name can be returned.',
}

const text = (sender: SenderPolicy, rules?: DepositRules, over: Partial<DepositAccount> = {}) =>
    buildShareText(account(sender, rules, over), copy, ROW_LABELS, RAIL_LABELS)

/**
 * The copied text is the account fields, the footer, and at most one line on
 * who may pay. The holder's full terms render on their own screen and stay out
 * of the message a payer pastes into a transfer form.
 */
describe('the shared text is the account fields and the footer', () => {
    it('carries the intro, the account numbers and the footer', () => {
        const out = text('anyone')
        expect(out).toContain('Here are my bank details to get paid in GBP:')
        expect(out).toContain('04-00-53')
        expect(out).toContain('Sent from Peanut · peanut.me')
    })

    it('adds nothing where anyone may pay', () => {
        expect(text('anyone')).not.toContain('Pay from a business account.')
        expect(text('anyone')).not.toContain('A transfer may be returned.')
    })

    /**
     * A friend who pays business-only details from a personal account gets the
     * transfer returned, and this message is the only place they can learn it.
     */
    it.each([
        ['business-only', 'Pay from a business account.'],
        ['unknown', 'A transfer may be returned.'],
    ] as const)('says who may pay, once, where the policy is %s', (sender, line) => {
        const out = text(sender)
        expect(out.split(line)).toHaveLength(2)
        // after the account numbers and before the footer
        expect(out.indexOf('04-00-53')).toBeLessThan(out.indexOf(line))
        expect(out.indexOf(line)).toBeLessThan(out.indexOf('Sent from Peanut'))
    })

    it('keeps the holder terms out of the copied text', () => {
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

    it('carries the reference, and says it is required, where the account has one', () => {
        const out = text('business-only', undefined, {
            railId: 'bridge.bank_transfer_co',
            instructions: {
                accountHolderName: 'Ana Pérez',
                breBKey: '@DEMO123',
                depositMessage: 'PEANUT-7F3A',
                paymentRails: [],
            },
        })
        expect(out).toContain('Reference: PEANUT-7F3A')
        expect(out.split('Add the reference to every transfer.')).toHaveLength(2)
        expect(out.indexOf('PEANUT-7F3A')).toBeLessThan(out.indexOf('Add the reference'))
    })

    it('says nothing about a reference where there is none', () => {
        expect(text('anyone')).not.toContain('Reference')
        expect(text('anyone')).not.toContain('Add the reference')
    })

    /**
     * EUR is offered to anyone, and the one third-party SEPA transfer seen so
     * far was returned as a third-party payment. Until a third-party euro
     * credit is proven, the payer is told what keeps their transfer safe.
     */
    it('carries the own-name caveat on the euro account, and on no other', () => {
        const eur = text('anyone', undefined, {
            railId: 'bridge.sepa_eu',
            currency: 'EUR',
            instructions: { accountHolderName: 'Ana Pérez', iban: 'DE89', paymentRails: ['sepa'] },
        })
        expect(eur.split('A euro transfer from another name can be returned.')).toHaveLength(2)
        expect(eur.indexOf('DE89')).toBeLessThan(eur.indexOf('A euro transfer'))
        expect(eur.indexOf('A euro transfer')).toBeLessThan(eur.indexOf('Sent from Peanut'))
        expect(text('anyone')).not.toContain('A euro transfer')
    })

    it('names a pooled account with the payer intro, never the possessive', () => {
        const out = text('anyone', undefined, { matching: { nameOnAccount: 'provider', sender: 'anyone' } })
        expect(out).toContain('Bank details to pay Ana in GBP:')
        expect(out).not.toContain('Here are my bank details')
    })

    it('uses neutral framing when the provider identity cannot be verified', () => {
        const out = text('anyone', undefined, { matching: { nameOnAccount: 'unknown', sender: 'anyone' } })
        expect(out).toContain('Bank details to pay Ana in GBP:')
        expect(out).not.toContain('Here are my bank details')
        expect(out).toContain('Account holder: Ana Pérez')
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
