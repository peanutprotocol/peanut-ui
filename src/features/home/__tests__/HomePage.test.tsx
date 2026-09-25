/**
 * One CTA class on Home at a time (Hugo, 2026-09-25): the getting-started
 * checklist until the first payment, the carousel after it. Never both.
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import type { OnboardingState } from '@/utils/activation-step.utils'

let mockFlow: { isOnboardingComplete: boolean; isActivated: boolean; onboarding: OnboardingState }
jest.mock('../useHomeFlow', () => ({
    useHomeFlow: () => ({
        isPageLoading: false,
        username: 'demo',
        spendableBalance: 0n,
        isFetchingSpendableBalance: false,
        isSpendableBalanceStale: false,
        isBalanceHidden: false,
        toggleBalanceVisibility: jest.fn(),
        ...mockFlow,
    }),
}))
jest.mock('../useHomeViewAnalytics', () => ({ useHomeViewAnalytics: () => {} }))
jest.mock('@/components/Home/ActivationCTAs', () => ({
    __esModule: true,
    default: () => <div>activation-checklist</div>,
}))
jest.mock('@/components/Home/HomeCarouselCTA', () => ({ __esModule: true, default: () => <div>home-carousel</div> }))
jest.mock('@/components/Home/EnableAutoBalanceBanner', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Home/HomeHistory', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Home/PendingVerificationTasks', () => ({ __esModule: true, default: () => null }))
jest.mock('../components/HomeActionDrawers', () => ({ HomeActionDrawers: () => null }))
jest.mock('../components/HomeModals', () => ({ HomeModals: () => null }))
jest.mock('../views/BalanceSection', () => ({ BalanceSection: () => null }))
jest.mock('../views/HomeTopNav', () => ({ HomeTopNav: () => null }))
jest.mock('@/components/0_Bruddle/PageContainer', () => ({
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

import { HomePage } from '../HomePage'

const FUNDED: OnboardingState = {
    verify: 'done',
    addMoneyDone: true,
    firstPaymentDone: false,
    firstPaymentRoute: 'card_qr',
    step: 'first_payment',
}

describe('HomePage — never two CTA classes at once', () => {
    it('before the first payment: the checklist, no carousel', () => {
        mockFlow = { isOnboardingComplete: false, isActivated: false, onboarding: FUNDED }
        render(<HomePage />)
        expect(screen.getByText('activation-checklist')).toBeInTheDocument()
        expect(screen.queryByText('home-carousel')).not.toBeInTheDocument()
    })

    it('after the first payment: the carousel, no checklist', () => {
        mockFlow = {
            isOnboardingComplete: true,
            isActivated: true,
            onboarding: { ...FUNDED, firstPaymentDone: true, step: 'completed' },
        }
        render(<HomePage />)
        expect(screen.getByText('home-carousel')).toBeInTheDocument()
        expect(screen.queryByText('activation-checklist')).not.toBeInTheDocument()
    })

    it('a user with no card and no QR who finished the three rows gets the carousel', () => {
        mockFlow = {
            isOnboardingComplete: true,
            isActivated: false,
            onboarding: { ...FUNDED, firstPaymentRoute: 'none', step: 'completed' },
        }
        render(<HomePage />)
        expect(screen.getByText('home-carousel')).toBeInTheDocument()
        expect(screen.queryByText('activation-checklist')).not.toBeInTheDocument()
    })
})
