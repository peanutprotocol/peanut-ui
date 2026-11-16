/** @jest-environment jsdom */
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import type { CapabilityRoute } from '@/types/capabilities'
import { withReturnTo } from '@/utils/return-to.utils'

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() }
jest.mock('next/navigation', () => ({ useRouter: () => mockRouter }))
jest.mock('posthog-js', () => ({ capture: jest.fn() }))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ fetchUser: jest.fn() }) }))
jest.mock('@/features/pix/usePixQuoteCurrency', () => ({
    usePixQuoteCurrency: () => ({ code: 'BRL', price: null, rateAndFee: null, quotesTypedAmount: false }),
}))
jest.mock('@/components/Provider/ProviderFinePrint', () => ({ ProviderFinePrint: () => null }))
jest.mock('@/components/AddMoney/components/InputAmountStep', () => ({ __esModule: true, default: () => null }))
// the success screen of a paid code: its Done button is the flow's onDone
jest.mock('@/features/pix/components/PixQrDeposit', () => ({
    PixQrDeposit: ({ onDone }: { onDone: () => void }) => <button onClick={onDone}>Done</button>,
}))

import { PixDepositFlow } from '../components/PixDepositFlow'
import { __testing as safeBackTesting } from '@/hooks/useSafeBack'

const route: CapabilityRoute = {
    operation: 'deposit',
    method: 'PIX_BR',
    provider: 'avenia',
    state: 'ready',
    candidates: [{ provider: 'avenia', state: 'ready' }],
}

const doneFrom = (returnTo?: string) => {
    const query = new URLSearchParams({ step: 'showQR', intentId: 'd1', ...(returnTo ? { returnTo } : {}) })
    renderWithIntl(
        <QueryClientProvider client={new QueryClient()}>
            <NuqsTestingAdapter searchParams={`?${query}`}>
                <PixDepositFlow route={route} />
            </NuqsTestingAdapter>
        </QueryClientProvider>
    )
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
}

// Aleks, 2026-11-15 (staging): Done after a paid Pix deposit reopened the Pix chooser instead of Home.
describe('Done after a completed Pix deposit', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        safeBackTesting.reset()
    })

    it.each([
        ['the Home drawer', undefined],
        ['the Add picker', '/add-money'],
    ])('goes Home in place of the success entry when Pix was opened from %s', (_from, returnTo) => {
        doneFrom(returnTo)
        expect(mockRouter.replace).toHaveBeenCalledWith('/home')
        expect(mockRouter.push).not.toHaveBeenCalled()
        expect(mockRouter.back).not.toHaveBeenCalled()
    })

    it('goes back to an origin a flow stated when it sent the user to add money', () => {
        doneFrom(withReturnTo('/add-money', '/request/abc'))
        expect(mockRouter.replace).toHaveBeenCalledWith('/request/abc')
    })

    it('rewinds to Home when Home is behind it, so Back does not reopen the code', () => {
        const go = jest.spyOn(window.history, 'go').mockImplementation(() => undefined)
        window.history.pushState(null, '', '/home')
        window.history.pushState(null, '', '/add-money/pix')
        window.history.pushState(null, '', '/add-money/pix?step=showQR&intentId=d1')
        doneFrom()
        expect(go).toHaveBeenCalledWith(-2)
        expect(mockRouter.replace).not.toHaveBeenCalled()
        go.mockRestore()
    })
})
