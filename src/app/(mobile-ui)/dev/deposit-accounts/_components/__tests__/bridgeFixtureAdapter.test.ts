import fixture from '../bridge-sandbox-virtual-accounts.json'
import { fromBridgeVirtualAccounts, type BridgeVirtualAccount } from '../bridgeFixtureAdapter'
import { mantecaArgentinaAccount } from '@/features/deposit-accounts/mantecaCorridors'
import { instructionRows } from '@/features/deposit-accounts/instructionRows'
import { buildShareText } from '@/features/deposit-accounts/shareText'
import enMessages from '@/i18n/app/messages/en.json'
import type { DepositAccount, DepositRowLabels } from '@/features/deposit-accounts/types'

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
        expect(accounts.map((account) => account.railId).sort()).toEqual([
            'bridge.ach_us',
            'bridge.faster_payments_gb',
            'bridge.sepa_eu',
            'bridge.spei_mx',
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

    it('takes any amount on every corridor', () => {
        accounts.forEach((account) => expect(account.matching.amount).toBe('flexible'))
    })

    /**
     * product/providers/fiat/rails/virtual-accounts.md: GBP is "1st party and
     * 3rd party business" only, USD/EUR/MXN are documented nowhere — and that
     * file is explicit that silence is not permission. USD is the exception:
     * Bridge caps person-to-person and exempts businesses, which only makes
     * sense if a private payer is allowed at all.
     */
    it('only promises third-party payment where the corridor proves it', () => {
        expect(byCurrency('USD').matching.sender).toBe('anyone')
        expect(byCurrency('GBP').matching.sender).toBe('business-only')
        expect(byCurrency('EUR').matching.sender).toBe('unknown')
        expect(byCurrency('MXN').matching.sender).toBe('unknown')
    })

    it('treats a deactivated account as revoked, not as still setting up', () => {
        const [deactivated] = fromBridgeVirtualAccounts(
            [{ ...(fixture.data[0] as BridgeVirtualAccount), status: 'deactivated' }],
            SANDBOX_USER
        )
        expect(deactivated.status).toBe('revoked')
    })

    it('fails closed on a status Bridge has not documented', () => {
        const [unknown] = fromBridgeVirtualAccounts(
            [{ ...(fixture.data[0] as BridgeVirtualAccount), status: 'something_new' }],
            SANDBOX_USER
        )
        expect(unknown.status).toBe('revoked')
    })

    it('ignores a currency we have no corridor for', () => {
        const unknown = [
            { id: 'x', status: 'activated', customer_id: 'c', source_deposit_instructions: { currency: 'jpy' } },
        ]
        expect(fromBridgeVirtualAccounts(unknown, SANDBOX_USER)).toEqual([])
    })
})

describe('manteca adapter', () => {
    const argentina = mantecaArgentinaAccount()

    it('models argentina as pooled and own-name-only', () => {
        expect(argentina.matching.nameOnAccount).toBe('provider')
        expect(argentina.matching.sender).toBe('own-name-only')
    })

    it('carries no standing instructions, because Manteca mints them per deposit', () => {
        // The screen renders a skeleton while details are on their way. Argentina
        // has none coming, so claiming it as `provisioning` left that skeleton
        // spinning for good — `unavailable` sends the user to the real top-up.
        expect(argentina.status).toBe('unavailable')
        expect(argentina.instructions).toBeUndefined()
    })
})

describe('instruction rows', () => {
    it('renders each corridor with only the fields it has', () => {
        const labels = (currency: string) =>
            instructionRows(byCurrency(currency).instructions!, ROW_LABELS).map((row) => row.label)

        expect(labels('EUR')).toEqual([
            'Account holder',
            'Bank',
            'IBAN',
            'BIC',
            'Bank address',
            'Recipient address',
            'Accepts',
        ])
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
            'Recipient address',
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

describe('the shared text carries what a payroll form asks for', () => {
    it('includes the recipient address where the corridor has one', () => {
        const account = byCurrency('EUR')
        const text = buildShareText(account, shareCopy(account, 'Ana Pérez'), ROW_LABELS)
        expect(text).toContain(account.instructions!.beneficiaryAddress!)
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
