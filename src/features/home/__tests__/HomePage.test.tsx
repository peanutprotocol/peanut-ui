/**
 * Home's CTA slot is the attention zone (features/attention): one card, the
 * manager's pick. The page only hands the slot over and tells the activity
 * feed whether to hide its empty state before activation.
 */
import React from 'react'
import { render, screen } from '@testing-library/react'

let mockFlow: { isOnboardingComplete: boolean; isActivated: boolean; isPageLoading?: boolean }
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
jest.mock('@/features/attention/AttentionZone', () => ({ HomeAttention: () => <div>attention-zone</div> }))
const mockHistory = jest.fn()
jest.mock('@/components/Home/HomeHistory', () => ({
    __esModule: true,
    default: (props: { hideEmptyState: boolean }) => {
        mockHistory(props)
        return null
    },
}))
jest.mock('../components/HomeActionDrawers', () => ({ HomeActionDrawers: () => null }))
jest.mock('../components/HomeModals', () => ({ HomeModals: () => null }))
jest.mock('../views/BalanceSection', () => ({ BalanceSection: () => null }))
jest.mock('../views/HomeTopNav', () => ({ HomeTopNav: () => null }))
jest.mock('@/components/0_Bruddle/PageContainer', () => ({
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))
jest.mock('@/components/Global/Loading', () => ({ __esModule: true, default: () => <div>loading</div> }))

import { HomePage } from '../HomePage'

beforeEach(() => mockHistory.mockClear())

it('renders the attention zone and hides the empty feed before activation', () => {
    mockFlow = { isOnboardingComplete: false, isActivated: false }
    render(<HomePage />)
    expect(screen.getByText('attention-zone')).toBeInTheDocument()
    expect(mockHistory).toHaveBeenCalledWith(expect.objectContaining({ hideEmptyState: true }))
})

it('shows the empty feed once onboarding is complete', () => {
    mockFlow = { isOnboardingComplete: true, isActivated: true }
    render(<HomePage />)
    expect(mockHistory).toHaveBeenCalledWith(expect.objectContaining({ hideEmptyState: false }))
})

it('shows the loader while the user loads', () => {
    mockFlow = { isOnboardingComplete: false, isActivated: false, isPageLoading: true }
    render(<HomePage />)
    expect(screen.getByText('loading')).toBeInTheDocument()
    expect(screen.queryByText('attention-zone')).not.toBeInTheDocument()
})
