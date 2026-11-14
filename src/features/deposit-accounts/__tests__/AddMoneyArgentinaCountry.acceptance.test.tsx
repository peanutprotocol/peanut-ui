import { fireEvent, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import messages from '@/i18n/app/messages/en.json'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import { DepositAccountsListScreen } from '@/features/deposit-accounts/components/DepositAccountsListScreen'
import { corridorRecord, DEPOSIT_RAIL_ORDER, emptyCorridorRecord } from '@/features/deposit-accounts/rails'
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))

const mockPush = jest.fn()
const mockOnOpen = jest.fn()
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn(), prefetch: jest.fn() }),
    usePathname: () => '/add-money',
    useSearchParams: () => new URLSearchParams(),
    useParams: () => ({}),
}))

jest.mock('@/context/ModalsContext', () => ({
    useModalsContextOptional: () => undefined,
    useModalsContext: () => ({ openSupportWithMessage: jest.fn() }),
}))
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: null }),
    useOptionalAuth: () => null,
}))
jest.mock('@/hooks/useGeoLocation', () => ({
    useGeoLocation: () => ({ countryCode: null, isLoading: false }),
}))
jest.mock('@/components/Global/EasterEggDrawer', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/EasterEggDrawer/easter-egg-countries.consts', () => ({
    EASTER_EGG_COUNTRIES: {},
}))

const mockOpenCountry = jest.fn()
const mockIsCountrySupported = jest.fn(() => true)
jest.mock('@/features/deposit-accounts/useDepositCountryRouting', () => ({
    useDepositCountryRouting: () => ({
        openCountry: mockOpenCountry,
        isCountrySupported: mockIsCountrySupported,
    }),
}))

let mockResidenceIso2s: string[] = []
jest.mock('@/features/deposit-accounts/useResidenceIso2s', () => ({ useResidenceIso2s: () => mockResidenceIso2s }))

jest.mock('@/features/deposit-accounts/useDepositAccountsEnabled', () => ({
    useDepositAccountsEnabled: () => true,
}))
jest.mock('@/hooks/useBankRows', () => ({ useBankRows: () => ({ rows: [] }) }))
jest.mock('@/hooks/useResidenceRestrictions', () => ({
    useResidenceRestrictions: () => ({ banking: false, card: false }),
}))

beforeEach(() => {
    jest.clearAllMocks()
    mockResidenceIso2s = []
})

const capture = (jest.requireMock('posthog-js') as { default: { capture: jest.Mock } }).default.capture

function showCountries(residence: string | null) {
    mockResidenceIso2s = residence ? [residence] : []

    render(
        <NextIntlClientProvider locale="en" messages={messages}>
            <NuqsTestingAdapter searchParams="?method=bank">
                <DepositAccountsListScreen
                    presentation="add-money"
                    corridors={DEPOSIT_RAIL_ORDER}
                    accounts={emptyCorridorRecord()}
                    claimable={emptyCorridorRecord()}
                    unavailable={emptyCorridorRecord()}
                    slotsHeld={0}
                    gates={corridorRecord(() => ({ kind: 'ready' }))}
                    isLoading={false}
                    isError={false}
                    onBack={jest.fn()}
                    onOpen={mockOnOpen}
                    onRetry={jest.fn()}
                />
            </NuqsTestingAdapter>
        </NextIntlClientProvider>
    )
    fireEvent.click(screen.getByTestId('other-countries-toggle'))
}

function argentinaRow() {
    return screen.getByRole('button', { name: /Argentina/i })
}

it.each(['pointer', 'Enter', 'Space'])(
    'keeps unavailable Argentina searchable and opens its residence explanation with %s',
    (input) => {
        showCountries('DE')
        expect(argentinaRow()).toBeVisible()
        expect(argentinaRow()).toHaveTextContent(/not available/i)

        const search = screen.getByRole('textbox')
        fireEvent.change(search, { target: { value: 'Argent' } })
        const row = argentinaRow()
        expect(row).toBeVisible()
        expect(row).toHaveTextContent(/not available/i)
        expect(row).toBeEnabled()
        expect(row).not.toHaveAttribute('aria-disabled', 'true')

        if (input === 'pointer') {
            fireEvent.click(row)
        } else {
            expect(row).toHaveAttribute('tabindex', '0')
            row.focus()
            fireEvent.keyDown(row, { key: input === 'Enter' ? 'Enter' : ' ' })
        }

        expect(
            screen.getByText(/(?:resid(?:e|en)|live).*argentina|argentin(?:a|e).*resid/i, { selector: 'p' })
        ).toBeVisible()
        expect(screen.getByRole('button', { name: /update residence/i })).toBeVisible()
        expect(screen.getByRole('button', { name: /pay a qr code/i })).toBeVisible()
        expect(screen.queryByRole('button', { name: /waitlist/i })).not.toBeInTheDocument()
        expect(mockOnOpen).not.toHaveBeenCalled()
        expect(mockOpenCountry).not.toHaveBeenCalled()
        expect(mockPush).not.toHaveBeenCalled()
        expect(capture.mock.calls.some(([event]) => event === 'add_money_country_selected')).toBe(false)
    }
)

it.each(['AR', null])('preserves ordinary Argentina selection for residence %s', (residence) => {
    showCountries(residence)
    fireEvent.click(argentinaRow())
    expect(mockOpenCountry).toHaveBeenCalledWith(expect.objectContaining({ path: 'argentina' }))
    expect(capture).toHaveBeenCalledWith(
        'add_money_country_selected',
        expect.objectContaining({ country: 'argentina', outcome: 'route' })
    )
})
