import { render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { FIXTURES } from '@/dev/fixtures/registry'
import type { IUserProfile } from '@/interfaces/interfaces'
import { loadMessages } from '@/i18n/app/messages'
import type { AppLocale } from '@/i18n/app/config'
import { ClosedRowDrawer } from '../components/ClosedRowDrawer'
import { closedBankRow } from '../hubRows'
import { buildBankRows } from '@/utils/unlock-payments.utils'

let mockResidence: IUserProfile['residence']
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: { residence: mockResidence } }) }))
jest.mock('@/context/ModalsContext', () => ({ useModalsContext: () => ({ openSupportWithMessage: jest.fn() }) }))
jest.mock('@/hooks/useIdentityVerification', () => ({ useIdentityVerification: () => ({ identity: undefined }) }))
jest.mock('@/hooks/useResidenceRestrictions', () => ({
    useResidenceRestrictions: () => ({ banking: false, card: false }),
}))

const fixtureProfile = FIXTURES['profile-accounts-card-state-blocked'].responses?.[
    'GET /users/me'
] as Partial<IUserProfile>

beforeEach(() => {
    mockResidence = fixtureProfile.residence
})

it.each<AppLocale>(['en', 'es-419', 'es-AR', 'pt-BR'])(
    'shows the US state copy in the open capture drawer in %s',
    async (locale) => {
        const messages = await loadMessages(locale)
        const { container } = render(
            <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
                <ClosedRowDrawer
                    closed={{ kind: 'card-restricted', reason: 'geo-blocked' }}
                    onClose={() => {}}
                    onChangeResidence={() => {}}
                />
            </NextIntlClientProvider>
        )
        expect(await screen.findByRole('dialog')).toHaveTextContent(
            messages.profile.unlockPayments.cardNotAvailableStateNote
        )
        // The real portalled drawer satisfies the same checkpoint CI uses.
        expect(
            container.ownerDocument.querySelector('[role="dialog"][data-state="open"][data-testid="closed-row-drawer"]')
        ).toBeVisible()
    }
)

it('uses country copy for a pending move outside the US instead of the state-only copy', async () => {
    mockResidence = {
        ...mockResidence!,
        declared: { ...mockResidence!.declared!, country: 'PT' },
    }
    const messages = await loadMessages('en')
    render(
        <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
            <ClosedRowDrawer
                closed={{ kind: 'card-restricted', reason: 'geo-blocked' }}
                onClose={() => {}}
                onChangeResidence={() => {}}
            />
        </NextIntlClientProvider>
    )
    expect(await screen.findByRole('dialog')).toHaveTextContent(messages.profile.unlockPayments.cardNotAvailableNote)
    expect(screen.queryByText(messages.profile.unlockPayments.cardNotAvailableStateNote)).not.toBeInTheDocument()
})

// TASK-24969: a bank row the provider refused read "Bank transfers aren't available
// for residents of your country", which is false for most refusals
it('words a provider refusal by its reason, never as the residence rule', async () => {
    const messages = await loadMessages('en')
    render(
        <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
            <ClosedRowDrawer
                closed={{ kind: 'refused', reason: 'some_code_without_app_copy' }}
                onClose={() => {}}
                onChangeResidence={() => {}}
            />
        </NextIntlClientProvider>
    )
    const dialog = await screen.findByRole('dialog')
    expect(dialog).not.toHaveTextContent(messages.profile.unlockPayments.bankOnlyNotAvailableNote)
    expect(dialog).toHaveTextContent(
        messages.kyc.supplement.unavailable.replace('{feature}', messages.kyc.documents.bank)
    )
})

// TASK-24969: Bridge refuses one account type per region (bridge_region_unavailable).
// The EUR row names EUR only; the same user's USD row stays usable.
it('names only the refused account when Bridge does not offer it in the region', async () => {
    const rows = buildBankRows({
        bankChips: { brl: 'unlock', ars: 'unlock', usd: 'unlock', mxn: 'unlock', sepa: 'notAvailable' },
        closedBecause: { sepa: 'refused' },
        refusalReasons: { sepa: 'bridge_region_unavailable' },
        residenceIso2: 'PT',
        isEuropeResidence: true,
    })
    const eur = rows.find((row) => row.labelKey === 'sepa')!
    const usd = rows.find((row) => row.labelKey === 'usd')!
    expect(closedBankRow(usd, false)).toBeNull()

    const messages = await loadMessages('en')
    render(
        <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
            <ClosedRowDrawer closed={closedBankRow(eur, false)} onClose={() => {}} onChangeResidence={() => {}} />
        </NextIntlClientProvider>
    )
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent(messages.depositAccounts.list.regionUnavailableBody.replace('{currency}', 'EUR'))
    expect(dialog).not.toHaveTextContent(messages.profile.unlockPayments.bankOnlyNotAvailableNote)
})
