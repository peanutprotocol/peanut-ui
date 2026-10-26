import { renderHook } from '@testing-library/react'
import { useAccountSetupRedirect } from '../useAccountSetupRedirect'

const mockPush = jest.fn()
let mockPathname = '/home'
let mockDemo = false
let mockAuth: { user: unknown; isFetchingUser: boolean } = { user: null, isFetchingUser: false }

jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockPush, replace: jest.fn() }),
    usePathname: () => mockPathname,
}))
jest.mock('@/context/authContext', () => ({ useAuth: () => mockAuth }))
jest.mock('@/utils/demo', () => ({ isDemoMode: () => mockDemo }))
jest.mock('@/utils/native-platform', () => ({ useHydrationSnapshot: (get: () => unknown) => get() }))

const account = (user: { username: string | null; email: string }, accounts: { type: string }[] = []) => ({
    user,
    accounts,
})

beforeEach(() => {
    jest.useFakeTimers()
    mockPush.mockClear()
    mockPathname = '/home'
    mockDemo = false
    mockAuth = { user: null, isFetchingUser: false }
})
afterEach(() => {
    jest.useRealTimers()
})

describe('useAccountSetupRedirect', () => {
    it.each([
        ['before', ''],
        ['after', 'test044@example.com'],
    ])('sends a signup interrupted %s its email back through the steps', (_label, email) => {
        mockAuth.user = account({ username: 'test044', email })
        const { result } = renderHook(() => useAccountSetupRedirect())
        expect(result.current.needsRedirect).toBe(true)
        expect(mockPush).toHaveBeenCalledWith('/setup')
    })

    it('sends an account /setup cannot resume, one without a username, to the wallet step', () => {
        mockAuth.user = account({ username: null, email: 'alice@example.com' })
        renderHook(() => useAccountSetupRedirect())
        expect(mockPush).toHaveBeenCalledWith('/setup/finish')
    })

    it.each([
        [
            'a finished account',
            () => (mockAuth.user = account({ username: 'alice', email: '' }, [{ type: 'peanut-wallet' }])),
        ],
        ['demo mode', () => ((mockAuth.user = account({ username: 'demo', email: '' })), (mockDemo = true))],
        [
            'a profile still loading',
            () => (mockAuth = { user: account({ username: 'a', email: '' }), isFetchingUser: true }),
        ],
        [
            'the finish page itself',
            () => ((mockAuth.user = account({ username: 'a', email: 'a@b.c' })), (mockPathname = '/setup/finish')),
        ],
    ])('leaves %s alone', (_label, arrange) => {
        arrange()
        const { result } = renderHook(() => useAccountSetupRedirect())
        expect(result.current.needsRedirect).toBe(false)
        expect(mockPush).not.toHaveBeenCalled()
    })
})
