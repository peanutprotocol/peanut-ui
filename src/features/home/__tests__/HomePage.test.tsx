/**
 * One CTA class on Home at a time (Hugo, 2026-09-25): the getting-started
 * checklist until the first payment, the carousel after it. Never both.
 */
import React from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { withNuqsTestingAdapter } from 'nuqs/adapters/testing'
import type { OnboardingState } from '@/utils/activation-step.utils'
import { IntlWrapper } from '@/test-utils/intl'
import { USDC_ACCOUNT, io, ok, pricingRequests, resetIo } from '@/test-utils/balance-io'

jest.mock('@/utils/api-fetch', () => require('@/test-utils/balance-io').apiFetchModule)
jest.mock('@/app/actions/clients', () => require('@/test-utils/balance-io').clientsModule)
jest.mock('@/context/authContext', () => require('@/test-utils/balance-io').authModule)
jest.mock('@/hooks/useAppHaptic', () => ({ useAppHaptic: () => ({ triggerHaptic: jest.fn() }) }))

let mockSpendableBalance: bigint | undefined = 0n
let mockFlow: {
    isOnboardingComplete: boolean
    isActivated: boolean
    onboarding: OnboardingState
    hiddenHomeCtas?: ReadonlySet<string>
    showWelcome?: boolean
}
jest.mock('../useHomeFlow', () => ({
    useHomeFlow: () => ({
        isPageLoading: false,
        username: 'demo',
        spendableBalance: mockSpendableBalance,
        isFetchingSpendableBalance: false,
        isSpendableBalanceStale: false,
        isBalanceHidden: false,
        toggleBalanceVisibility: jest.fn(),
        hideCta: jest.fn(),
        hiddenHomeCtas: new Set<string>(),
        showWelcome: true,
        ...mockFlow,
    }),
}))
jest.mock('../useHomeViewAnalytics', () => ({ useHomeViewAnalytics: () => {} }))
jest.mock('@/components/Home/ActivationCTAs', () => ({
    __esModule: true,
    default: ({ showWelcome }: { showWelcome: boolean }) => (
        <div>
            activation-checklist
            {showWelcome && <span>welcome-card</span>}
        </div>
    ),
}))
jest.mock('@/components/Home/HomeCarouselCTA', () => ({ __esModule: true, default: () => <div>home-carousel</div> }))
jest.mock('@/components/Home/EnableAutoBalanceBanner', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Home/HomeHistory', () => ({ __esModule: true, default: () => null }))
// The real component renders `whenEmpty` only when it has no large task card
// of its own; the marker mirrors that single-surface contract.
let mockHasTaskCard = false
jest.mock('@/components/Home/PendingVerificationTasks', () => ({
    __esModule: true,
    default: ({ whenEmpty }: { whenEmpty: React.ReactNode }) =>
        mockHasTaskCard ? <div>verification-task-card</div> : <>{whenEmpty}</>,
}))
jest.mock('@/hooks/useCapabilities', () => ({ useCapabilities: () => ({ nextActions: [], rails: [] }) }))
jest.mock('@/utils/bridge-tasks.utils', () => ({ selectHomeTasks: () => ({ documentSlide: undefined }) }))
let mockHasProviderRejection = false
const BLOCKED = {
    kind: 'verification-issue',
    reasonCode: 'provider_rejected',
    ctaId: 'blocked-card:verification-issue:provider_rejected',
}
jest.mock('@/hooks/useProviderRejection', () => ({
    useProviderRejection: () => ({
        hasProviderRejection: mockHasProviderRejection,
        blockedCard: mockHasProviderRejection ? BLOCKED : null,
    }),
}))
jest.mock('../components/HomeActionDrawers', () => ({ HomeActionDrawers: () => null }))
jest.mock('../components/HomeModals', () => ({ HomeModals: () => null }))
jest.mock('../components/EurcAccountView', () => ({ EurcAccountView: () => <div>eurc-account-view</div> }))
jest.mock('../views/HomeTopNav', () => ({ HomeTopNav: () => null }))
jest.mock('@/components/0_Bruddle/PageContainer', () => ({
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

import { HomePage } from '../HomePage'

let client: QueryClient
const Nuqs = withNuqsTestingAdapter({ searchParams: '' })
const renderHome = () =>
    render(
        <IntlWrapper>
            <QueryClientProvider client={client}>
                <Nuqs>
                    <HomePage />
                </Nuqs>
            </QueryClientProvider>
        </IntlWrapper>
    )

beforeEach(() => {
    resetIo()
    mockSpendableBalance = 0n
    client = new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0 } } })
})
afterEach(() => client.clear())

const FUNDED: OnboardingState = {
    verify: 'done',
    addMoneyDone: true,
    firstPaymentDone: false,
    firstPaymentRoute: 'card_qr',
    step: 'first_payment',
}

describe('HomePage — never two CTA classes at once', () => {
    beforeEach(() => {
        mockHasTaskCard = false
        mockHasProviderRejection = false
    })

    it('a due verification task card replaces the checklist', () => {
        mockHasTaskCard = true
        mockFlow = { isOnboardingComplete: false, isActivated: false, onboarding: FUNDED }
        renderHome()
        expect(screen.getByText('verification-task-card')).toBeInTheDocument()
        expect(screen.queryByText('activation-checklist')).not.toBeInTheDocument()
        expect(screen.queryByText('home-carousel')).not.toBeInTheDocument()
    })

    it('before the first payment: the checklist, no carousel', () => {
        mockFlow = { isOnboardingComplete: false, isActivated: false, onboarding: FUNDED }
        renderHome()
        expect(screen.getByText('activation-checklist')).toBeInTheDocument()
        expect(screen.queryByText('home-carousel')).not.toBeInTheDocument()
    })

    it('an expired welcome keeps the checklist in its Home slot', () => {
        mockFlow = { isOnboardingComplete: false, isActivated: false, onboarding: FUNDED, showWelcome: false }
        renderHome()
        expect(screen.queryByText('welcome-card')).not.toBeInTheDocument()
        expect(screen.getByText('activation-checklist')).toBeInTheDocument()
        expect(screen.queryByText('home-carousel')).not.toBeInTheDocument()
    })

    it('after the first payment: the carousel, no checklist', () => {
        mockFlow = {
            isOnboardingComplete: true,
            isActivated: true,
            onboarding: { ...FUNDED, firstPaymentDone: true, step: 'completed' },
        }
        renderHome()
        expect(screen.getByText('home-carousel')).toBeInTheDocument()
        expect(screen.queryByText('activation-checklist')).not.toBeInTheDocument()
    })

    it('a rejected bank rail keeps its card even when the three rows are done', () => {
        mockHasProviderRejection = true
        mockFlow = {
            isOnboardingComplete: true,
            isActivated: false,
            onboarding: { ...FUNDED, firstPaymentRoute: 'none', step: 'completed' },
        }
        renderHome()
        expect(screen.getByText('activation-checklist')).toBeInTheDocument()
        expect(screen.queryByText('home-carousel')).not.toBeInTheDocument()
    })

    it('a user with no card and no QR who finished the three rows gets the carousel', () => {
        mockFlow = {
            isOnboardingComplete: true,
            isActivated: false,
            onboarding: { ...FUNDED, firstPaymentRoute: 'none', step: 'completed' },
        }
        renderHome()
        expect(screen.getByText('home-carousel')).toBeInTheDocument()
        expect(screen.queryByText('activation-checklist')).not.toBeInTheDocument()
    })

    it('with only the payment row left the checklist stays: it has no hide (TASK-23340)', () => {
        mockFlow = { isOnboardingComplete: false, isActivated: false, onboarding: FUNDED }
        renderHome()
        expect(screen.getByText('activation-checklist')).toBeInTheDocument()
        expect(screen.queryByText('home-carousel')).not.toBeInTheDocument()
    })

    it('a hidden blocked card hands over to the carousel', () => {
        mockHasProviderRejection = true
        mockFlow = {
            isOnboardingComplete: false,
            isActivated: false,
            onboarding: FUNDED,
            hiddenHomeCtas: new Set([BLOCKED.ctaId]),
        }
        renderHome()
        expect(screen.getByText('home-carousel')).toBeInTheDocument()
        expect(screen.queryByText('activation-checklist')).not.toBeInTheDocument()
    })

    it('a blocked card hidden under another reason code shows again', () => {
        mockHasProviderRejection = true
        mockFlow = {
            isOnboardingComplete: false,
            isActivated: false,
            onboarding: FUNDED,
            hiddenHomeCtas: new Set(['blocked-card:verification-issue:an_older_reason']),
        }
        renderHome()
        expect(screen.getByText('activation-checklist')).toBeInTheDocument()
        expect(screen.queryByText('home-carousel')).not.toBeInTheDocument()
    })
})

describe('HomePage balance', () => {
    beforeEach(() => {
        mockFlow = { isOnboardingComplete: false, isActivated: false, onboarding: FUNDED }
    })

    it('shows the home flow’s USD spendable balance above the CTA slot', async () => {
        mockSpendableBalance = 123_450_000n
        renderHome()
        const amount = await screen.findByText('123.45')
        expect(screen.getByText('$')).toBeInTheDocument()
        const cta = screen.getByText('activation-checklist')
        expect(amount.compareDocumentPosition(cta) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })

    it('keeps a USD-only user on the dollar balance with no EURC tab, Base read or pricing request', async () => {
        io.accounts.mockImplementation(() => ok({ accounts: [USDC_ACCOUNT], available: [] }))
        mockSpendableBalance = 42_000_000n
        renderHome()
        await waitFor(() => expect(io.accounts).toHaveBeenCalled())
        await act(async () => new Promise((resolve) => setTimeout(resolve, 50)))
        expect(screen.getByText('42')).toBeInTheDocument()
        expect(screen.queryAllByRole('tab')).toEqual([])
        expect(screen.queryByText('EUR · EURC')).not.toBeInTheDocument()
        expect(screen.queryByText('eurc-account-view')).not.toBeInTheDocument()
        expect(io.baseRead).not.toHaveBeenCalled()
        expect(pricingRequests()).toEqual([])
    })
})
