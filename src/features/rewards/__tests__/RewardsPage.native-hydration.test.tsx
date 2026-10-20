import React from 'react'
import { act, waitFor } from '@testing-library/react'
import { hydrateRoot, type Root } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { IntlWrapper } from '@/test-utils/intl'
import { RewardsPage } from '@/features/rewards/RewardsPage'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'

jest.mock('react-dom/server', () => jest.requireActual('react-dom/server.node'))
jest.mock('@tanstack/react-query', () => ({
    useQuery: ({ queryKey }: { queryKey: unknown[] }) => ({
        data: {
            tierInfo: {
                success: true,
                data: { totalPoints: 150, currentTier: 1, nextTierThreshold: 500, pointsToNextTier: 350 },
            },
            invites: { invitees: [] },
            cashStatus: { totalEarned: 10 },
        }[String(queryKey[0])],
        isPending: false,
        isLoading: false,
        isError: false,
        error: null,
    }),
}))
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('next/image', () => () => null)
jest.mock('posthog-js', () => ({ capture: jest.fn() }))
jest.mock('framer-motion', () => ({ useInView: () => false }))
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: { user: { userId: 'user-1', username: 'alice' } } }),
}))
jest.mock('@/hooks/useSafeBack', () => ({ useSafeBack: () => jest.fn() }))
jest.mock('@/hooks/useCountUp', () => ({ useCountUp: (value: number) => value }))
jest.mock('@/services/invites', () => ({ invitesApi: { getInvites: jest.fn() } }))
jest.mock('@/services/points', () => ({
    pointsApi: { getTierInfo: jest.fn(), getUserInvitesGraph: jest.fn(), getCashStatus: jest.fn() },
}))
jest.mock('@/utils/format.utils', () => ({ shortenPoints: (value: number) => ({ number: String(value), suffix: '' }) }))
jest.mock('@/utils/native-routes', () => ({ profileUrl: (username: string) => `/${username}` }))
jest.mock('@/utils/general.utils', () => ({ getInitialsFromName: () => 'A' }))
jest.mock('@/components/Global/Card/card.utils', () => ({ getCardPosition: () => 'solo' }))
jest.mock(
    '@/components/0_Bruddle/PageContainer',
    () =>
        function MockPageContainer({ children }: { children?: React.ReactNode }) {
            return <div data-testid="rewards-page">{children}</div>
        }
)
jest.mock('@/components/0_Bruddle/Button', () => ({
    Button: ({ children }: { children?: React.ReactNode }) => <button>{children}</button>,
}))
jest.mock(
    '@/components/Global/Card',
    () =>
        function MockCard({ children }: { children?: React.ReactNode }) {
            return <div>{children}</div>
        }
)
jest.mock('@/components/Global/Icons/Icon', () => ({ Icon: () => null }))
jest.mock('@/components/Global/PeanutMascot/PeanutMascotScene', () => ({ PeanutMascotScene: () => null }))
jest.mock('@/components/Global/NavHeader', () => () => null)
jest.mock('@/components/Global/NavigationArrow', () => () => null)
jest.mock('@/components/Global/InvitesGraph', () => () => null)
jest.mock('@/components/Global/InviteFriendsModal', () => () => null)
jest.mock('@/components/Points/InviteePointsBadge', () => () => null)
jest.mock('@/components/TransactionDetails/TransactionAvatarBadge', () => () => null)
jest.mock('@/components/UserHeader', () => ({ VerifiedUserLabel: () => null }))
jest.mock(
    '@/components/Global/Loading',
    () =>
        function MockLoading() {
            return <div data-testid="loading" />
        }
)
jest.mock(
    '@/components/Global/EmptyStates/EmptyState',
    () =>
        function MockEmptyState({ title }: { title?: string }) {
            return <div>{title}</div>
        }
)

function CopyProbe() {
    const t = useAppTranslations('rewards')
    return <output data-testid="translated-copy">{t('lifetimeRewards', { amount: '$10.00' })}</output>
}
function Tree() {
    return (
        <IntlWrapper>
            <RewardsPage />
            <CopyProbe />
        </IntlWrapper>
    )
}

describe('RewardsPage native hydration with actual app translations', () => {
    let container: HTMLDivElement
    let root: Root | undefined
    let previousBridge: PropertyDescriptor | undefined
    beforeEach(() => {
        previousBridge = Object.getOwnPropertyDescriptor(window, 'Capacitor')
        Reflect.deleteProperty(window, 'Capacitor')
        container = document.createElement('div')
        document.body.appendChild(container)
    })
    afterEach(() => {
        if (root) act(() => root!.unmount())
        root = undefined
        container.remove()
        if (previousBridge) Object.defineProperty(window, 'Capacitor', previousBridge)
        else Reflect.deleteProperty(window, 'Capacitor')
    })

    it.each(['ios', 'android'] as const)(
        'preserves settled web SSR nodes while adopting %s copy and sections',
        async (platform) => {
            container.innerHTML = renderToString(<Tree />)
            const serverNode = container.querySelector('[data-testid="rewards-page"]')
            expect(serverNode).not.toBeNull()
            expect(container).toHaveTextContent('150')
            expect(container).not.toHaveTextContent('How it works')
            const serverCopy = container.querySelector('[data-testid="translated-copy"]')
            expect(serverCopy).toHaveTextContent('Lifetime rewards: $10.00. To earn more, invite friends.')
            window.Capacitor = { getPlatform: () => platform, isNativePlatform: () => true }
            const onRecoverableError = jest.fn()
            await act(async () => {
                root = hydrateRoot(container, <Tree />, { onRecoverableError })
            })
            await waitFor(() => {
                if (platform === 'ios') {
                    expect(container).toHaveTextContent('How it works')
                    expect(container.querySelector('[data-testid="translated-copy"]')).toHaveTextContent(
                        'Earned so far: $10.00'
                    )
                } else {
                    expect(container).not.toHaveTextContent('How it works')
                    expect(container.querySelector('[data-testid="translated-copy"]')).toHaveTextContent(
                        'Lifetime rewards: $10.00. To earn more, invite friends.'
                    )
                }
            })
            expect(container.querySelector('[data-testid="rewards-page"]')).toBe(serverNode)
            expect(container.querySelector('[data-testid="translated-copy"]')).toBe(serverCopy)
            expect(onRecoverableError).not.toHaveBeenCalled()
        }
    )
})
