/**
 * MantecaAddMoney — denomination defaulting + URL round-trip.
 *
 * The input must open in the country's LOCAL currency (ARS/BRL) — matching the
 * withdraw flow — unless the URL explicitly pins one (?currency=USD). This was
 * silently narrowed to Brazil-only once (3ab066885); this suite pins it.
 * The ?currency= param stores ISO codes while AmountInput reports display
 * symbols ('R$'), so the write-back must map symbol → code or the enum parser
 * silently drops it. Nested primitives are stubbed so only this component's
 * own logic is under test.
 */
import React from 'react'
import { render as rtlRender, screen } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
// jest.mock calls are hoisted above this import, so the mocks below apply to it
import MantecaAddMoney from '../MantecaAddMoney'

const render = (ui: React.ReactElement, options?: Omit<Parameters<typeof rtlRender>[1], 'wrapper'>) =>
    rtlRender(ui, { wrapper: IntlWrapper, ...options })

const mockParams: Record<string, string> = {}
jest.mock('next/navigation', () => ({
    useParams: () => mockParams,
    useSearchParams: () => ({ get: () => null }),
}))

const mockQueryState: Record<string, unknown> = {}
const mockSetQueryState = jest.fn((updates: Record<string, unknown>) => {
    Object.entries(updates).forEach(([k, v]) => {
        mockQueryState[k] = v
    })
})
jest.mock('nuqs', () => ({
    useQueryStates: () => [mockQueryState, mockSetQueryState],
    parseAsString: {},
    parseAsStringEnum: () => ({}),
}))

jest.mock('@tanstack/react-query', () => ({
    useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}))

jest.mock('@/hooks/useSafeBack', () => ({ useSafeBack: () => jest.fn() }))

jest.mock('@/components/AddMoney/consts', () => ({
    countryData: [
        { type: 'country', id: 'AR', path: 'argentina', title: 'Argentina', currency: 'ARS' },
        { type: 'country', id: 'BR', path: 'brazil', title: 'Brazil', currency: 'BRL' },
    ],
}))

jest.mock('@/utils/native-routes', () => ({ addMoneyCountryUrl: (path: string) => `/add-money/${path}` }))

jest.mock('@/hooks/useCurrency', () => ({
    useCurrency: (code: string | null) => ({
        code,
        symbol: code === 'BRL' ? 'R$' : code,
        price: { buy: 1000, sell: 1000 },
        isLoading: false,
        isError: false,
    }),
}))

jest.mock('@/hooks/useCapabilities', () => ({ useCapabilities: () => ({ rails: [] }) }))
jest.mock('@/hooks/useIdentityVerification', () => ({ useIdentityVerification: () => ({ isVerified: true }) }))
jest.mock('@/utils/regions.utils', () => ({ isVerifiedForCountry: () => true }))
jest.mock('@/utils/provider-rejection.utils', () => ({ deriveProviderRejection: () => ({ state: 'none' }) }))
jest.mock('@/hooks/useMultiPhaseKycFlow', () => ({
    useMultiPhaseKycFlow: () => ({ error: null, isLoading: false }),
}))
jest.mock('@/features/limits/hooks/useLimitsValidation', () => ({
    useLimitsValidation: () => ({ isBlocking: false, isWarning: false, currency: 'USD' }),
}))

jest.mock('@/services/manteca', () => ({ mantecaApi: { deposit: jest.fn() } }))
jest.mock('posthog-js', () => ({ capture: jest.fn() }))

jest.mock('@/components/Kyc/SumsubKycModals', () => ({ SumsubKycModals: () => null }))
jest.mock('@/components/Kyc/InitiateKycModal', () => ({ InitiateKycModal: () => null }))
jest.mock('@/components/AddMoney/components/MantecaDepositShareDetails', () => ({
    __esModule: true,
    default: () => <div data-testid="share-details" />,
}))
jest.mock('@/components/AddMoney/components/MantecaPixQrDeposit', () => ({
    __esModule: true,
    default: () => <div data-testid="pix-qr" />,
}))
jest.mock('@/components/Global/PeanutLoading/CyclingLoading', () => ({ __esModule: true, default: () => <div /> }))

// records the props MantecaAddMoney hands to the amount step
type InputStepProps = { initialDenomination?: string; setCurrentDenomination: (denomination: string) => void }
let lastInputStepProps: InputStepProps | null = null
jest.mock('@/components/AddMoney/components/InputAmountStep', () => ({
    __esModule: true,
    default: (props: InputStepProps) => {
        lastInputStepProps = props
        return <div data-testid="input-amount-step" data-denomination={props.initialDenomination} />
    },
}))

const setCountry = (path: string) => {
    mockParams.country = path
}

beforeEach(() => {
    Object.keys(mockQueryState).forEach((k) => delete mockQueryState[k])
    mockSetQueryState.mockClear()
    lastInputStepProps = null
})

describe('denomination default', () => {
    test('Argentina opens in ARS (local currency), not USD', () => {
        setCountry('argentina')
        render(<MantecaAddMoney />)

        expect(screen.getByTestId('input-amount-step')).toHaveAttribute('data-denomination', 'ARS')
    })

    test('Brazil opens in BRL (local currency)', () => {
        setCountry('brazil')
        render(<MantecaAddMoney />)

        expect(screen.getByTestId('input-amount-step')).toHaveAttribute('data-denomination', 'BRL')
    })

    test('an explicit ?currency=USD deep-link still wins', () => {
        setCountry('argentina')
        mockQueryState.currency = 'USD'
        render(<MantecaAddMoney />)

        expect(screen.getByTestId('input-amount-step')).toHaveAttribute('data-denomination', 'USD')
    })
})

describe('denomination change → URL write-back', () => {
    test("Brazil maps AmountInput's display symbol R$ to the ISO code BRL", () => {
        setCountry('brazil')
        render(<MantecaAddMoney />)

        lastInputStepProps!.setCurrentDenomination('R$')

        expect(mockSetQueryState).toHaveBeenCalledWith({ currency: 'BRL' })
    })

    test('toggling to USD writes USD', () => {
        setCountry('argentina')
        render(<MantecaAddMoney />)

        lastInputStepProps!.setCurrentDenomination('USD')

        expect(mockSetQueryState).toHaveBeenCalledWith({ currency: 'USD' })
    })
})
