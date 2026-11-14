import { render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { FIXTURES } from '@/dev/fixtures/registry'
import type { IUserProfile } from '@/interfaces/interfaces'
import { loadMessages } from '@/i18n/app/messages'
import type { AppLocale } from '@/i18n/app/config'
import { ClosedRowDrawer } from '../components/ClosedRowDrawer'

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
