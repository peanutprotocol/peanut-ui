import { render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import { renderWithIntl } from '@/test-utils/intl'
import VerifyRoute from '@/app/(mobile-ui)/verify/page'
import { loadMessages } from '@/i18n/app/messages'

let mockDown = true
jest.mock('@/hooks/useKycDegraded', () => ({ useKycDegraded: () => mockDown }))
jest.mock('@/hooks/useSafeBack', () => ({ useSafeBack: () => jest.fn() }))
jest.mock('../PaperworkVerificationFlow', () => ({ PaperworkVerificationFlow: () => <div>ordinary verification</div> }))
jest.mock('../IdentityRestartFlow', () => ({ IdentityRestartFlow: () => <div>replacement verification</div> }))
jest.mock('../AddFeatureFlow', () => ({ AddFeatureFlow: () => <div>feature verification</div> }))
jest.mock('@/components/Global/PeanutMascot', () => ({ __esModule: true, default: () => null }))

it.each(['', '?feature=bank', '?step=id&restart=1'])(
    'outage blocks verification entry %s through the shared switch',
    (query) => {
        mockDown = true
        renderWithIntl(
            <NuqsTestingAdapter searchParams={query}>
                <VerifyRoute />
            </NuqsTestingAdapter>
        )
        expect(screen.getByTestId('verify-outage')).toBeInTheDocument()
        expect(screen.queryByText(/ordinary verification|replacement verification|feature verification/)).toBeNull()
    }
)
it('switch recovery restores the requested entry', () => {
    mockDown = false
    renderWithIntl(
        <NuqsTestingAdapter searchParams="?feature=local">
            <VerifyRoute />
        </NuqsTestingAdapter>
    )
    expect(screen.getByText('feature verification')).toBeInTheDocument()
})

it.each([
    ['en', 'Peanut can’t verify residents of this country yet.', 'Update the Peanut app to continue verification.'],
    [
        'es-419',
        'Peanut aún no puede verificar a residentes de este país.',
        'Actualiza la app de Peanut para continuar con la verificación.',
    ],
    [
        'es-AR',
        'Peanut aún no puede verificar a residentes de este país.',
        'Actualizá la app de Peanut para continuar con la verificación.',
    ],
    [
        'pt-BR',
        'A Peanut ainda não consegue verificar residentes deste país.',
        'Atualize o app da Peanut para continuar a verificação.',
    ],
] as const)('shows the terminal residence screen in %s', async (locale, residence, update) => {
    mockDown = false
    const messages = await loadMessages(locale)
    render(
        <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
            <NuqsTestingAdapter searchParams="?reason=residence_not_supported">
                <VerifyRoute />
            </NuqsTestingAdapter>
        </NextIntlClientProvider>
    )
    expect(screen.getByRole('heading', { name: residence })).toBeInTheDocument()
    expect(screen.getAllByRole('button')).toHaveLength(1)
    expect(screen.queryByText('ordinary verification')).not.toBeInTheDocument()
    expect(messages.kyc.clientUpdateRequired).toBe(update)
})
