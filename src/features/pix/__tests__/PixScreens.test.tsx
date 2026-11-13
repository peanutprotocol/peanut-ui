/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react'
import type { CapabilityRoute } from '@/types/capabilities'

jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
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
jest.mock('@/features/pix/components/PixDepositFlow', () => ({
    PixDepositFlow: ({ route }: { route: CapabilityRoute }) => (
        <div>
            pix deposit {route.provider} {route.state}
        </div>
    ),
}))
jest.mock('@/features/pix/components/PixWithdrawFlow', () => ({
    PixWithdrawFlow: ({ route }: { route: CapabilityRoute }) => (
        <div>
            pix withdraw {route.provider} {route.state}
        </div>
    ),
}))

import { PixAddMoney } from '../components/PixAddMoney'
import { PixWithdraw } from '../components/PixWithdraw'

const route = (operation: 'deposit' | 'withdraw', overrides: Partial<CapabilityRoute> = {}): CapabilityRoute => ({
    operation,
    method: 'PIX_BR',
    provider: 'manteca',
    state: 'ready',
    candidates: [],
    ...overrides,
})

describe('the neutral Pix screens', () => {
    beforeEach(() => {
        mockRoutes = undefined
        mockLoading = false
    })

    it('mount the one Pix flow, with its route, whichever provider the route names', () => {
        mockRoutes = [route('deposit', { state: 'action_required', action: 'activate' }), route('withdraw')]
        const { unmount } = render(<PixAddMoney />)
        expect(screen.getByText('pix deposit manteca action_required')).toBeInTheDocument()
        unmount()
        const withdraw = render(<PixWithdraw />)
        expect(screen.getByText('pix withdraw manteca ready')).toBeInTheDocument()
        withdraw.unmount()
    })

    // the router reads the pause switches: the paused route is the only pause these pages show. A resident of
    // Brazil has no provider for Pix, so the route names none (TASK-24910, D9)
    it('show the residence pause in its own words, with or without a provider', () => {
        const residencePaused = { state: 'paused' as const, reason: { code: 'residence_paused', userMessage: '' } }
        mockRoutes = [route('deposit', { provider: null, ...residencePaused }), route('withdraw', residencePaused)]
        const { unmount } = render(<PixAddMoney />)
        expect(screen.getByText('brazil paused')).toBeInTheDocument()
        expect(screen.queryByText(/pix deposit/)).toBeNull()
        unmount()
        render(<PixWithdraw />)
        expect(screen.getByText('brazil paused')).toBeInTheDocument()
        expect(screen.queryByText(/pix withdraw/)).toBeNull()
    })

    it("show the outage for a provider's or a currency's pause", () => {
        mockRoutes = [
            route('deposit', {
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
        expect(screen.queryByText(/pix deposit/)).toBeNull()
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
