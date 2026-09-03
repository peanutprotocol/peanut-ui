import React from 'react'
import { render, screen } from '@testing-library/react'

type QueryResult = { data?: unknown; isPending?: boolean; isLoading?: boolean; isError?: boolean; error?: unknown }

const mockQueryResults: Record<string, QueryResult> = {}

jest.mock('@tanstack/react-query', () => ({
    useQuery: ({ queryKey }: { queryKey: unknown[] }) =>
        mockQueryResults[String(queryKey[0])] ?? {
            data: undefined,
            isPending: false,
            isLoading: false,
            isError: false,
        },
}))

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('next/image', () => () => null)
jest.mock('posthog-js', () => ({ capture: jest.fn() }))
jest.mock('framer-motion', () => ({ useInView: () => false }))
jest.mock('@/i18n/app/useAppTranslations', () => ({ useAppTranslations: () => (key: string) => key }))
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: { user: { userId: 'user-1', username: 'alice' } }, fetchUser: jest.fn() }),
}))
jest.mock('@/hooks/useSafeBack', () => ({ useSafeBack: () => jest.fn() }))
jest.mock('@/hooks/useCountUp', () => ({ useCountUp: (value: number) => value }))
jest.mock('@/services/invites', () => ({ invitesApi: { getInvites: jest.fn() } }))
jest.mock('@/services/points', () => ({
    pointsApi: { getTierInfo: jest.fn(), getUserInvitesGraph: jest.fn(), getCashStatus: jest.fn() },
}))
jest.mock('@/utils/capacitor', () => ({ isIOSNative: () => false }))
jest.mock('@/utils/format.utils', () => ({ shortenPoints: (n: number) => ({ number: String(n), suffix: '' }) }))
jest.mock('@/utils/native-routes', () => ({ profileUrl: (u: string) => `/${u}` }))
jest.mock('@/utils/general.utils', () => ({ getInitialsFromName: () => 'A' }))
jest.mock('@/components/Global/Card/card.utils', () => ({ getCardPosition: () => 'single' }))
jest.mock('@/components/0_Bruddle/PageContainer', () => {
    return function MockPageContainer(p: { children?: React.ReactNode }) {
        return <div>{p.children}</div>
    }
})
jest.mock('@/components/0_Bruddle/Button', () => ({
    Button: (p: { children?: React.ReactNode }) => <button>{p.children}</button>,
}))
jest.mock('@/components/Global/Card', () => {
    return function MockCard(p: { children?: React.ReactNode }) {
        return <div>{p.children}</div>
    }
})
jest.mock('@/components/Global/Icons/Icon', () => ({ Icon: () => null }))
jest.mock('@/components/Global/NavHeader', () => () => null)
jest.mock('@/components/Global/NavigationArrow', () => () => null)
jest.mock('@/components/Global/InvitesGraph', () => () => null)
jest.mock('@/components/Global/InviteFriendsModal', () => () => null)
jest.mock('@/components/Points/InviteePointsBadge', () => () => null)
jest.mock('@/components/TransactionDetails/TransactionAvatarBadge', () => () => null)
jest.mock('@/components/UserHeader', () => ({ VerifiedUserLabel: () => null }))
jest.mock('@/components/Global/Loading', () => {
    return function MockLoading() {
        return <div data-testid="loading" />
    }
})
// EmptyState is shared: the page uses it for the points failure AND, further
// down, for "no invites yet". Key the stub on the title so a test can name the
// one it means — a bare testid matches both.
jest.mock('@/components/Global/EmptyStates/EmptyState', () => {
    return function MockEmptyState(p: { title?: string }) {
        return <div data-testid={`empty-state-${p.title}`}>{p.title}</div>
    }
})

import RewardsPage from '../page'

// Flag combinations as react-query 5.8.4 actually reports them. A disabled query
// is pending but NOT loading, which is what separates "not started" from
// "settled with nothing in it".
const NOT_STARTED = { data: undefined, isPending: true, isLoading: false, isError: false }
const IN_FLIGHT = { data: undefined, isPending: true, isLoading: true, isError: false }

// pointsApi.getTierInfo catches its own failures and resolves with data: null,
// so a failed GET /points looks like a settled query with nothing in it.
const TIER_INFO_FAILED = { data: { success: false, data: null }, isPending: false, isLoading: false, isError: false }
const TIER_INFO_OK = {
    data: { success: true, data: { totalPoints: 150, currentTier: 1, nextTierThreshold: 500, pointsToNextTier: 350 } },
    isPending: false,
    isLoading: false,
    isError: false,
}

describe('RewardsPage when the points total fails to load', () => {
    beforeEach(() => {
        for (const key of Object.keys(mockQueryResults)) delete mockQueryResults[key]
        mockQueryResults.invites = { data: { invitees: [] }, isPending: false, isLoading: false, isError: false }
    })

    it('shows the loader while both queries wait on the user, not the error state', () => {
        // Both queries are `enabled: !!user?.user.userId`, so on a cold load they
        // are disabled: pending, never started, no data.
        mockQueryResults.invites = NOT_STARTED
        mockQueryResults.tierInfo = NOT_STARTED

        render(<RewardsPage />)

        expect(screen.getByTestId('loading')).toBeInTheDocument()
        expect(screen.queryByTestId('empty-state-loadPointsFailed')).not.toBeInTheDocument()
    })

    it('shows the error state instead of spinning forever', () => {
        mockQueryResults.tierInfo = TIER_INFO_FAILED

        render(<RewardsPage />)

        expect(screen.getByTestId('empty-state-loadPointsFailed')).toBeInTheDocument()
        expect(screen.queryByTestId('loading')).not.toBeInTheDocument()
    })

    it('still shows the loader while the points total is in flight', () => {
        mockQueryResults.tierInfo = IN_FLIGHT

        render(<RewardsPage />)

        expect(screen.getByTestId('loading')).toBeInTheDocument()
        expect(screen.queryByTestId('empty-state-loadPointsFailed')).not.toBeInTheDocument()
    })

    it('renders the points total when the request succeeds', () => {
        mockQueryResults.tierInfo = TIER_INFO_OK

        const { container } = render(<RewardsPage />)

        expect(container).toHaveTextContent('150 pointsLabel')
        expect(screen.queryByTestId('empty-state-loadPointsFailed')).not.toBeInTheDocument()
        expect(screen.queryByTestId('loading')).not.toBeInTheDocument()
    })
})
