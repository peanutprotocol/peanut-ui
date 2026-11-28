jest.mock('@/components/0_Bruddle/Toast', () => ({ useToast: () => ({ error: jest.fn() }) }))
import { act, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import { renderWithIntl } from '@/test-utils/intl'
import { getKycQuestions } from '@/app/actions/kyc-paperwork-verification'
import { serverFetch } from '@/utils/api-fetch'
import { PaperworkVerificationFlow } from '../PaperworkVerificationFlow'

const mockReplace = jest.fn()
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: jest.fn(), replace: mockReplace, back: jest.fn(), prefetch: jest.fn() }),
}))
jest.mock('@/utils/api-fetch', () => ({ serverFetch: jest.fn() }))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('@/app/actions/kyc-paperwork-verification', () => ({ getKycQuestions: jest.fn() }))
jest.mock('@/context/authContext', () => ({
    useOptionalAuth: () => null,
    useAuth: () => ({ user: null, fetchUser: jest.fn() }),
}))
jest.mock('@/hooks/useWebSocket', () => ({ useWebSocket: jest.fn() }))
jest.mock('@/hooks/useSafeBack', () => ({ useSafeBack: () => jest.fn() }))
jest.mock('@/hooks/useSumsubKycFlow', () => ({ useSumsubKycFlow: jest.fn() }))
jest.mock('@/components/Global/PeanutMascot', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/Loading', () => ({ __esModule: true, default: () => <div>loading</div> }))

beforeEach(() => {
    jest.useFakeTimers()
    jest.mocked(getKycQuestions).mockResolvedValue({ available: true } as never)
    jest.mocked(serverFetch).mockRejectedValue(new TypeError('Failed to fetch'))
})
afterEach(() => jest.useRealTimers())

it.each([
    [200, { available: false, routes: [], unavailableReason: 'residence_not_supported' }],
    [403, { code: 'residence_not_supported' }],
])('explains residence unavailability without offering a retry for HTTP %s', async (status, body) => {
    jest.mocked(serverFetch).mockResolvedValue({
        ok: status === 200,
        status,
        json: async () => body,
    } as Response)
    renderWithIntl(
        <QueryClientProvider client={new QueryClient()}>
            <NuqsTestingAdapter>
                <PaperworkVerificationFlow />
            </NuqsTestingAdapter>
        </QueryClientProvider>
    )
    await act(async () => {
        await jest.runAllTimersAsync()
    })

    expect(screen.getAllByText(/residen|country|where you live|region|location/i).length).toBeGreaterThan(0)
    expect(screen.queryByText(/residence_not_supported/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /retry|try again/i })).not.toBeInTheDocument()
    expect(screen.queryByTestId('verify-retry-load')).not.toBeInTheDocument()
    expect(mockReplace).not.toHaveBeenCalledWith('/home')
})
