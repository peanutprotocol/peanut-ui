import fixture from '../__fixtures__/bridge-sandbox-virtual-accounts.json'
import { fromBridgeVirtualAccounts, type BridgeVirtualAccount } from '../adapters/bridge'
import { fromMantecaArgentina } from '../adapters/manteca'
import { instructionRows } from '../instructionRows'
import { buildShareText } from '../shareText'
import enMessages from '@/i18n/app/messages/en.json'
import type { DepositAccount, DepositRowLabels } from '../types'

// captured from Bridge sandbox on 2026-09-11 by
// mono projects/virtual-accounts/capture-sandbox-vas.sh
const SANDBOX_USER = 'Sandbox User'
const accounts = fromBridgeVirtualAccounts(fixture.data as BridgeVirtualAccount[], SANDBOX_USER)
const byCurrency = (currency: string) => accounts.find((account) => account.currency === currency) as DepositAccount

// the real English labels, so a renamed row key fails here too
const ROW_LABELS = enMessages.depositAccounts.rows as DepositRowLabels

const shareCopy = (account: DepositAccount, user: string) => ({
    introOwn: `Here are my bank details to get paid in ${account.currency}:`,
    introPooled: `Bank details to pay ${user} in ${account.currency}:`,
    outro: 'Sent from Peanut · peanut.me',
})

describe('bridge adapter', () => {
    it('maps every sandbox corridor', () => {
        expect(accounts.map((account) => account.corridor).sort()).toEqual([
            'EUR_SEPA',
            'GBP_FPS',
            'MXN_SPEI',
            'USD_ACH',
        ])
    })

    it('reads the holder name from whichever field the corridor carries', () => {
        // USD has bank_beneficiary_name and no account_holder_name
        expect(byCurrency('USD').instructions?.accountHolderName).toBe(SANDBOX_USER)
        // GBP has account_holder_name and no bank_beneficiary_name
        expect(byCurrency('GBP').instructions?.accountHolderName).toBe('Bridge Building S.A.')
    })

    it('derives name-on-account per corridor, not per provider', () => {
        expect(byCurrency('EUR').matching.nameOnAccount).toBe('user')
        expect(byCurrency('USD').matching.nameOnAccount).toBe('user')
        expect(byCurrency('MXN').matching.nameOnAccount).toBe('user')
        // pooled today — the reason the check is data-driven
        expect(byCurrency('GBP').matching.nameOnAccount).toBe('provider')
    })

    it('carries no reference on any corridor', () => {
        accounts.forEach((account) => {
            expect(account.matching.memo).toBe('none')
            expect(account.instructions?.memo).toBeUndefined()
        })
    })

    it('accepts payment from anyone, in any amount', () => {
        accounts.forEach((account) => {
            expect(account.matching.sender).toBe('anyone')
            expect(account.matching.amount).toBe('flexible')
        })
    })

    it('ignores a currency we have no corridor for', () => {
        const unknown = [
            { id: 'x', status: 'activated', customer_id: 'c', source_deposit_instructions: { currency: 'jpy' } },
        ]
        expect(fromBridgeVirtualAccounts(unknown, SANDBOX_USER)).toEqual([])
    })
})

describe('manteca adapter', () => {
    const argentina = fromMantecaArgentina({ depositAddress: '0000003100010000000001', depositAlias: 'peanut.ars' })

    it('models argentina as pooled and own-name-only', () => {
        expect(argentina.matching.nameOnAccount).toBe('provider')
        expect(argentina.matching.sender).toBe('own-name-only')
        expect(argentina.instructions?.accountHolderName).toBe('Sixalime Sas')
    })
})

describe('instruction rows', () => {
    it('renders each corridor with only the fields it has', () => {
        const labels = (currency: string) =>
            instructionRows(byCurrency(currency).instructions!, ROW_LABELS).map((row) => row.label)

        expect(labels('EUR')).toEqual(['Account holder', 'Bank', 'IBAN', 'BIC', 'Bank address', 'Accepts'])
        expect(labels('GBP')).toEqual([
            'Account holder',
            'Bank',
            'Sort code',
            'Account number',
            'Bank address',
            'Accepts',
        ])
        expect(labels('USD')).toEqual([
            'Account holder',
            'Bank',
            'Account number',
            'Routing number',
            'Bank address',
            'Accepts',
        ])
        // SPEI returns a CLABE and nothing else — no bank name, no address
        expect(labels('MXN')).toEqual(['Account holder', 'CLABE', 'Accepts'])
    })

    it('names the rails a payer can use', () => {
        const accepts = instructionRows(byCurrency('USD').instructions!, ROW_LABELS).find(
            (row) => row.key === 'accepts'
        )
        expect(accepts?.value).toBe('ACH · FedNow · Wire')
        expect(accepts?.copyable).toBe(false)
    })
})

describe('share text', () => {
    const textFor = (currency: string) => {
        const account = byCurrency(currency)
        return buildShareText(account, shareCopy(account, 'Ana Pérez'), ROW_LABELS)
    }

    it('uses the possessive only when the account is in the user name', () => {
        expect(textFor('EUR')).toContain('Here are my bank details')
    })

    it('never claims a pooled account as the user own', () => {
        const text = textFor('GBP')
        expect(text).toContain('Bank details to pay Ana Pérez in GBP')
        expect(text).not.toMatch(/\bmy\b/i)
    })

    it('leaves the informational row out of the pasted text', () => {
        expect(textFor('USD')).not.toContain('Accepts:')
    })
})
