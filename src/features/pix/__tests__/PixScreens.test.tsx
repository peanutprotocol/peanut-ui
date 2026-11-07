/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react'
import type { CapabilityRoute } from '@/types/capabilities'

jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
jest.mock('nuqs', () => ({
    parseAsString: {},
    useQueryStates: () => [{ destination: null, isSavedAccount: null }, jest.fn()],
}))
let mockRoutes: CapabilityRoute[] | undefined
let mockLoading = false
jest.mock('@/hooks/useCapabilities', () => ({
    useCapabilities: () => ({ capabilities: { routes: mockRoutes }, isLoading: mockLoading }),
}))
jest.mock('@/components/Global/Loading', () => ({ __esModule: true, default: () => <div>loading</div> }))
jest.mock('@/components/Global/Banner/MantecaTransfersMaintenanceView', () => ({
    MantecaTransfersMaintenanceView: ({ action }: { action: string }) => <div>outage {action}</div>,
}))
jest.mock('@/features/brazil-pause/components/BrazilPausedScreen', () => ({
    BrazilPausedScreen: () => <div>brazil paused</div>,
}))
jest.mock('@/features/pix/components/PixUnavailableScreen', () => ({
    PixUnavailableScreen: () => <div>unavailable</div>,
}))
jest.mock('@/features/avenia/components/AveniaAddMoneyFlow', () => ({
    AveniaAddMoneyFlow: ({ route }: { route: CapabilityRoute }) => <div>avenia deposit {route.state}</div>,
}))
jest.mock('@/features/avenia/components/AveniaWithdrawFlow', () => ({
    AveniaWithdrawFlow: ({ route }: { route: CapabilityRoute }) => <div>avenia withdraw {route.state}</div>,
}))
jest.mock('@/components/AddMoney/components/MantecaAddMoney', () => ({
    __esModule: true,
    default: ({ countryPath }: { countryPath: string }) => <div>manteca deposit {countryPath}</div>,
}))
jest.mock('@/features/paperwork-verification/KycFeatureActivationGate', () => ({
    KycFeatureActivationGate: ({ children }: { children: React.ReactNode }) => children,
}))
jest.mock('@/features/withdraw/views/MantecaBankWithdrawFlow', () => ({
    __esModule: true,
    default: ({ searchParams }: { searchParams: URLSearchParams }) => (
        <div>manteca withdraw {searchParams.get('country')}</div>
    ),
}))

import { PixAddMoney } from '../components/PixAddMoney'
import { PixWithdraw } from '../components/PixWithdraw'

const route = (operation: 'deposit' | 'withdraw', overrides: Partial<CapabilityRoute> = {}): CapabilityRoute => ({
    operation,
    method: 'PIX_BR',
    provider: 'avenia',
    state: 'ready',
    candidates: [],
    ...overrides,
})

describe('the neutral Pix screens', () => {
    beforeEach(() => {
        mockRoutes = undefined
        mockLoading = false
    })

    it("mount Avenia's screens when the route names Avenia", () => {
        mockRoutes = [route('deposit', { state: 'action_required', action: 'activate' }), route('withdraw')]
        const { unmount } = render(<PixAddMoney />)
        expect(screen.getByText('avenia deposit action_required')).toBeInTheDocument()
        unmount()
        render(<PixWithdraw />)
        expect(screen.getByText('avenia withdraw ready')).toBeInTheDocument()
    })

    it("mount Manteca's screens, for Brazil, when the route names Manteca", () => {
        mockRoutes = [route('deposit', { provider: 'manteca' }), route('withdraw', { provider: 'manteca' })]
        const { unmount } = render(<PixAddMoney />)
        expect(screen.getByText('manteca deposit brazil')).toBeInTheDocument()
        unmount()
        render(<PixWithdraw />)
        expect(screen.getByText('manteca withdraw brazil')).toBeInTheDocument()
    })

    // the router reads the pause switches: the paused route is the only pause these pages show
    it('show the residence pause in its own words, for either provider', () => {
        const residencePaused = { state: 'paused' as const, reason: { code: 'residence_paused', userMessage: '' } }
        mockRoutes = [route('deposit', { provider: 'manteca', ...residencePaused }), route('withdraw', residencePaused)]
        const { unmount } = render(<PixAddMoney />)
        expect(screen.getByText('brazil paused')).toBeInTheDocument()
        expect(screen.queryByText(/manteca deposit/)).toBeNull()
        unmount()
        render(<PixWithdraw />)
        expect(screen.getByText('brazil paused')).toBeInTheDocument()
        expect(screen.queryByText(/avenia withdraw/)).toBeNull()
    })

    it("show the outage for a provider's or a currency's pause", () => {
        mockRoutes = [
            route('deposit', {
                provider: 'manteca',
                state: 'paused',
                reason: { code: 'provider_paused', userMessage: '' },
            }),
        ]
        render(<PixAddMoney />)
        expect(screen.getByText('outage deposits')).toBeInTheDocument()
    })

    it('show a refused route as not available, even when its best candidate is Manteca', () => {
        mockRoutes = [
            route('deposit', {
                provider: null,
                state: 'refused',
                candidates: [{ provider: 'manteca', state: 'refused' }],
            }),
        ]
        render(<PixAddMoney />)
        expect(screen.getByText('unavailable')).toBeInTheDocument()
        expect(screen.queryByText(/manteca deposit/)).toBeNull()
    })

    it('show the outage screen on a paused route, and never fall back to another provider', () => {
        mockRoutes = [route('withdraw', { state: 'paused' })]
        const { unmount } = render(<PixWithdraw />)
        expect(screen.getByText('outage withdrawals')).toBeInTheDocument()
        unmount()
        mockRoutes = []
        render(<PixAddMoney />)
        expect(screen.getByText('unavailable')).toBeInTheDocument()
    })
})
