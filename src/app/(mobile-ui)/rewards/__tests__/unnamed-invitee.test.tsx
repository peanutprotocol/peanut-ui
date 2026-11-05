/**
 * An invitee who never finished signup has no username and no name
 * (TASK-24036). Both screens that list invitees must render that row, without
 * initials and without a profile link, instead of crashing the whole page.
 * getInitialsFromName is the real one: the crash was its `.trim()` on null.
 */
jest.mock('@/utils/native-platform', () => require('@/test-utils/native-platform-mock').createNativePlatformMock())

import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'

type QueryResult = { data?: unknown; isPending?: boolean; isLoading?: boolean; isError?: boolean }

const mockQueryResults: Record<string, QueryResult> = {}
const mockPush = jest.fn()

jest.mock('@tanstack/react-query', () => ({
    useQuery: ({ queryKey }: { queryKey: unknown[] }) =>
        mockQueryResults[String(queryKey[0])] ?? {
            data: undefined,
            isPending: false,
            isLoading: false,
            isError: false,
        },
}))

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))
jest.mock('next/image', () => () => null)
jest.mock('posthog-js', () => ({ capture: jest.fn() }))
jest.mock('framer-motion', () => ({ useInView: () => false }))
jest.mock('@/i18n/app/useAppTranslations', () => ({ useAppTranslations: () => (key: string) => key }))
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: { user: { userId: 'user-1', username: 'alice' } } }),
}))
jest.mock('@/hooks/useSafeBack', () => ({ useSafeBack: () => jest.fn() }))
jest.mock('@/hooks/useCountUp', () => ({ useCountUp: (value: number) => value }))
jest.mock('@/services/invites', () => ({ invitesApi: { getInvites: jest.fn() } }))
jest.mock('@/services/points', () => ({
    pointsApi: { getTierInfo: jest.fn(), getUserInvitesGraph: jest.fn(), getCashStatus: jest.fn() },
}))
jest.mock('@/utils/capacitor', () => ({ isIOSNative: () => false, isCapacitor: () => false }))
jest.mock('@/utils/format.utils', () => ({
    shortenPoints: (n: number) => ({ number: String(n), suffix: '' }),
    formatPoints: (n: number) => String(n),
}))
jest.mock('@/utils/native-routes', () => ({ profileUrl: (u: string) => `/${u}` }))
jest.mock('@/components/Global/Card/card.utils', () => ({ getCardPosition: () => 'solo' }))
jest.mock('@/components/0_Bruddle/PageContainer', () => {
    return function MockPageContainer(p: { children?: React.ReactNode }) {
        return <div>{p.children}</div>
    }
})
jest.mock('@/components/0_Bruddle/Button', () => ({
    Button: (p: { children?: React.ReactNode }) => <button>{p.children}</button>,
}))
jest.mock('@/components/Global/Card', () => {
    return function MockCard(p: { children?: React.ReactNode; onClick?: () => void }) {
        return (
            <div data-testid="card" onClick={p.onClick}>
                {p.children}
            </div>
        )
    }
})
jest.mock('@/components/Global/Icons/Icon', () => ({ Icon: () => null }))
jest.mock('@/components/Global/PeanutMascot/PeanutMascotScene', () => ({ PeanutMascotScene: () => null }))
jest.mock('@/components/Global/NavHeader', () => () => null)
jest.mock('@/components/Global/NavigationArrow', () => () => null)
jest.mock('@/components/Global/InvitesGraph', () => () => null)
jest.mock('@/components/Global/InviteFriendsModal', () => () => null)
jest.mock('@/components/Points/InviteePointsBadge', () => () => null)
jest.mock('@/components/TransactionDetails/TransactionAvatarBadge', () => {
    return function MockAvatar(p: { initials: string }) {
        return <span data-testid="initials">{p.initials}</span>
    }
})
jest.mock('@/components/UserHeader', () => ({
    VerifiedUserLabel: (p: { name: string }) => <span data-testid="invitee-name">{p.name}</span>,
}))
jest.mock('@/components/Global/Loading', () => {
    return function MockLoading() {
        return <div data-testid="loading" />
    }
})
jest.mock('@/components/Global/EmptyStates/EmptyState', () => {
    return function MockEmptyState(p: { title?: string }) {
        return <div data-testid={`empty-state-${p.title}`}>{p.title}</div>
    }
})

import RewardsRoute from '../page'
import InvitesRoute from '../invites/page'

const SETTLED = { isPending: false, isLoading: false, isError: false }
const INVITES = {
    invitees: [
        { inviteeId: 'named', username: 'bob', fullName: null, kycVerified: true, contributedPoints: 5 },
        { inviteeId: 'unnamed', username: null, fullName: null, kycVerified: false, contributedPoints: 0 },
    ],
    summary: { totalInvites: 2, verifiedInvites: 1, pendingInvites: 1 },
}

describe.each([
    ['rewards', RewardsRoute],
    ['rewards invites', InvitesRoute],
])('%s screen with an invitee who never finished signup', (_name, Screen) => {
    beforeEach(() => {
        mockPush.mockClear()
        for (const key of Object.keys(mockQueryResults)) delete mockQueryResults[key]
        mockQueryResults.invites = { data: INVITES, ...SETTLED }
        mockQueryResults.tierInfo = {
            data: { success: true, data: { totalPoints: 150, currentTier: 1, nextTierThreshold: 500 } },
            ...SETTLED,
        }
    })

    it('renders both rows; the unnamed one has no initials and no name', () => {
        render(<Screen />)

        expect(screen.getAllByTestId('initials').map((el) => el.textContent)).toEqual(['BO', ''])
        expect(screen.getAllByTestId('invitee-name').map((el) => el.textContent)).toEqual(['bob', ''])
    })

    it('opens a profile only for the invitee who has one', () => {
        render(<Screen />)
        const [named, unnamed] = screen.getAllByTestId('initials').map((el) => el.closest('[data-testid="card"]')!)

        fireEvent.click(unnamed)
        expect(mockPush).not.toHaveBeenCalled()

        fireEvent.click(named)
        expect(mockPush).toHaveBeenCalledWith('/bob')
    })
})
