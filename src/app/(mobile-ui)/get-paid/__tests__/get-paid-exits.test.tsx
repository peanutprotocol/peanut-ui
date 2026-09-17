/**
 * Where back leaves the get-paid flow, entry point by entry point.
 *
 * The flow is reached three ways — the home Add drawer, the alternative on
 * /request, and a direct link — and every one of them has to land the user
 * where they started. Two things make that non-obvious: the step lives in the
 * URL, so leaving must not carry a `?step=` anywhere; and `useSafeBack` falls
 * back to /home when there is no in-app history, which strands anybody who
 * arrived at the entry point by deep link. That is why the callers name their
 * origin in `?returnTo=` rather than trusting history.
 */
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

const mockPush = jest.fn()
const mockReplace = jest.fn()
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockPush, replace: mockReplace, back: jest.fn(), prefetch: jest.fn() }),
}))

let returnToParam: string | null = null
jest.mock('nuqs', () => ({
    useQueryState: () => [returnToParam, jest.fn()],
    parseAsString: {},
}))

const mockSafeBack = jest.fn()
jest.mock('@/hooks/useSafeBack', () => ({ useSafeBack: () => mockSafeBack }))

// the flow itself is covered by its own tests; surface only its exit and the
// variant, which is how this route differs from /add-money?method=bank
jest.mock('@/features/deposit-accounts/components/DepositAccountsFlow', () => ({
    DepositAccountsFlow: ({ variant, onExit }: { variant: string; onExit: () => void }) => (
        <button data-variant={variant} onClick={onExit}>
            exit
        </button>
    ),
}))
jest.mock('@/features/deposit-accounts/useDepositAccounts', () => ({
    useDepositAccounts: () => ({
        corridors: [],
        accounts: {},
        gates: {},
        isLoading: false,
        isError: false,
        claim: jest.fn(),
        refetch: jest.fn(),
    }),
}))
jest.mock('@/features/deposit-accounts/useDepositAccountsEnabled', () => ({ useDepositAccountsEnabled: () => true }))
jest.mock('@/features/deposit-accounts/useDepositGateRemediation', () => ({
    useDepositGateRemediation: () => ({ resolveGate: jest.fn(), modals: null }),
}))
jest.mock('@/hooks/useFlagsSettled', () => ({ useFlagsSettled: () => true }))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: null }) }))
jest.mock('@/context/ModalsContext', () => ({ useModalsContext: () => ({ openSupportWithMessage: jest.fn() }) }))

import GetPaidPage from '../page'
import { withReturnTo } from '@/utils/return-to.utils'

const exitFrom = (returnTo: string | null) => {
    returnToParam = returnTo
    render(<GetPaidPage />)
    fireEvent.click(screen.getByText('exit'))
}

beforeEach(() => {
    jest.clearAllMocks()
    returnToParam = null
})

describe('leaving the get-paid flow', () => {
    it('the home Add drawer: no origin named, so back walks real history', () => {
        exitFrom(null)
        expect(mockSafeBack).toHaveBeenCalled()
        expect(mockPush).not.toHaveBeenCalled()
    })

    it('/request: lands back on the request screen, not on home', () => {
        exitFrom('/request')
        expect(mockPush).toHaveBeenCalledWith('/request')
        expect(mockSafeBack).not.toHaveBeenCalled()
    })

    it('a deep link names its own origin and gets it back', () => {
        exitFrom('/home?drawer=add')
        expect(mockPush).toHaveBeenCalledWith('/home?drawer=add')
    })

    it('never carries the step cursor out of the flow', () => {
        exitFrom('/request')
        expect(mockPush.mock.calls[0][0]).not.toContain('step=')
    })

    /**
     * A returnTo pointing at get-paid itself would make back a no-op, so the
     * shared reader drops it and the history walk takes over.
     */
    it('ignores an origin that is the flow itself', () => {
        exitFrom('/get-paid')
        expect(mockSafeBack).toHaveBeenCalled()
        expect(mockPush).not.toHaveBeenCalled()
    })
})

/**
 * /get-paid and /add-money?method=bank render one screen. This route is the
 * alias that titles it for the accounts and opens on them.
 */
describe('the get-paid alias', () => {
    it('renders the shared screen in its get-paid variant', () => {
        render(<GetPaidPage />)
        expect(screen.getByText('exit')).toHaveAttribute('data-variant', 'get-paid')
    })
})

describe('the /request entry point', () => {
    it('names /request as the origin, so the link survives a deep-linked visit', () => {
        expect(withReturnTo('/get-paid', '/request')).toBe('/get-paid?returnTo=%2Frequest')
    })
})
