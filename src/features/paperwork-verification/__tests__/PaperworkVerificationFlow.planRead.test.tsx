/**
 * APK #4: /verify read a failed plan GET as "the server keeps this user on
 * today's flow" and sent them Home, where the same failure opened the legacy
 * start. The plan read is real here, down to the fetch.
 */
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

it('a plan that cannot be read shows the retry screen, never Home', async () => {
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

    expect(screen.getByTestId('verify-retry-load')).toBeInTheDocument()
    expect(mockReplace).not.toHaveBeenCalledWith('/home')
})
