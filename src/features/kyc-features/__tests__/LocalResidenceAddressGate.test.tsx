/** Spec-only tests: authored without reading the gate implementation. */
import React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { LocalResidenceAddressGate } from '../LocalResidenceAddressGate'

const mockResolveGate = jest.fn()
const mockBack = jest.fn()
const mockFetchUser = jest.fn(async () => null)
type Entry = { state: string; reason?: string; action?: string }
let mockLocal: Entry & { accounts?: Record<string, Entry> }
let mockNextActions: Record<string, unknown>[]
const addressAction = {
    key: 'sumsub:address_of_residence',
    kind: 'sumsub',
    levelKey: 'address_of_residence',
    purpose: 'residence_address_required',
}
const required: Entry = {
    state: 'action_required',
    reason: 'residence_unresolved',
    action: addressAction.key,
}

jest.mock('@/context/authContext', () => ({ useAuth: () => ({ fetchUser: mockFetchUser }) }))

jest.mock('@/hooks/useCapabilities', () => ({
    useCapabilities: () => ({
        rails: [],
        nextActions: mockNextActions,
        capabilities: { features: { local: { accounts: {}, ...mockLocal } }, nextActions: mockNextActions },
    }),
}))
jest.mock('@/features/deposit-accounts/useDepositGateRemediation', () => ({
    useDepositGateRemediation: () => ({
        resolveGate: mockResolveGate,
        modals: <div data-testid="remediation-host" />,
        isLoading: false,
        error: null,
    }),
}))
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
jest.mock('@/components/Global/PeanutMascot', () => ({
    __esModule: true,
    default: () => null,
    PeanutMascot: () => null,
}))
jest.mock('use-haptic', () => ({ useHaptic: () => ({ triggerHaptic: jest.fn() }) }))
jest.mock('@/components/Global/NavHeader', () => ({
    __esModule: true,
    default: ({ onPrev }: { onPrev: () => void }) => <button onClick={onPrev}>Back</button>,
}))
jest.mock('@/components/0_Bruddle/PageContainer', () => ({
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => children,
}))

const tree = (currency: 'ARS' | 'BRL' = 'ARS') => (
    <LocalResidenceAddressGate currency={currency} onBack={mockBack}>
        <input aria-label="Local account details" />
    </LocalResidenceAddressGate>
)
const blocked = () => expect(screen.queryByLabelText('Local account details')).not.toBeInTheDocument()

beforeEach(() => {
    jest.clearAllMocks()
    mockLocal = { state: 'ready', accounts: { ARS: required, BRL: required } }
    mockNextActions = [{ ...addressAction }]
})

it.each([
    ['ARS', 'BANK_TRANSFER_AR'],
    ['BRL', 'PIX_BR'],
] as const)('%s requires the address before exposing details and launches its own corridor', (currency, corridor) => {
    render(tree(currency))
    blocked()
    expect(screen.getByText('gate.addressTitle')).toBeInTheDocument()
    expect(mockResolveGate).not.toHaveBeenCalled()
    const buttons = screen.getAllByRole('button').filter((button) => button.textContent !== 'Back')
    expect(buttons).toHaveLength(1)
    fireEvent.click(buttons[0])
    expect(mockResolveGate).toHaveBeenCalledTimes(1)
    expect(mockResolveGate).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'fixable-rejection', actionKey: addressAction.key, nextAction: addressAction }),
        corridor
    )
    blocked()
})

it('offers the rejection retry while keeping details hidden', () => {
    mockNextActions = [{ ...addressAction, purpose: 'residence_address_rejected' }]
    render(tree())
    blocked()
    expect(screen.getByText('gate.addressRetryTitle')).toBeInTheDocument()
    const retry = screen.getAllByRole('button').find((button) => button.textContent !== 'Back')!
    fireEvent.click(retry)
    expect(mockResolveGate).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'fixable-rejection' }),
        'BANK_TRANSFER_AR'
    )
})

it.each([
    ['residence_unresolved', 'gate.waitTitle'],
    ['residence_address_in_review', 'gate.addressReviewTitle'],
])('blocks %s setup without offering an address launch', (reason, title) => {
    mockLocal = { state: 'setting_up', reason }
    render(tree())
    blocked()
    expect(screen.getByText(title)).toBeInTheDocument()
    expect(mockResolveGate).not.toHaveBeenCalled()
    for (const button of screen.getAllByRole('button')) fireEvent.click(button)
    expect(mockResolveGate).not.toHaveBeenCalled()
})

it.each([
    { actions: [] },
    { actions: [{ ...addressAction, key: 'sumsub:other' }] },
    { actions: [{ ...addressAction, kind: 'contact-support' }] },
    { actions: [{ ...addressAction, levelKey: 'source_of_funds' }] },
    { actions: [{ key: addressAction.key }] },
])('keeps an absent or malformed address descriptor unavailable: %j', ({ actions }) => {
    mockNextActions = actions
    render(tree())
    blocked()
    expect(screen.getByText('gate.waitTitle')).toBeInTheDocument()
    expect(mockResolveGate).not.toHaveBeenCalled()
    for (const button of screen.getAllByRole('button')) fireEvent.click(button)
    expect(mockResolveGate).not.toHaveBeenCalled()
})

it('uses the currency account before the aggregate local feature', () => {
    mockLocal = { ...required, accounts: { ARS: { state: 'ready' }, BRL: required } }
    render(tree('ARS'))
    expect(screen.getByLabelText('Local account details')).toBeInTheDocument()
    expect(mockResolveGate).not.toHaveBeenCalled()
})

it('falls back to the local feature when the currency entry is absent', () => {
    mockLocal = { ...required, accounts: { BRL: { state: 'ready' } } }
    render(tree('ARS'))
    blocked()
    expect(screen.getByText('gate.addressTitle')).toBeInTheDocument()
})

it.each(['on', 'ready', 'refused'])('does not let a stale residence reason block %s', (state) => {
    mockLocal = { state, reason: 'residence_unresolved' }
    render(tree())
    expect(screen.getByLabelText('Local account details')).toBeInTheDocument()
})

it('reveals details only after the refreshed report clears the blocker', () => {
    const { rerender } = render(tree())
    blocked()
    mockLocal = { state: 'setting_up', reason: 'residence_address_in_review' }
    rerender(tree())
    blocked()
    mockLocal = { state: 'ready' }
    rerender(tree())
    expect(screen.getByLabelText('Local account details')).toBeInTheDocument()
})

it('lets Back leave a blocked address screen', () => {
    render(tree())
    fireEvent.click(screen.getByRole('button', { name: /back/i }))
    expect(mockBack).toHaveBeenCalledTimes(1)
    blocked()
})

it('bounds review refreshes to 24 attempts and clears polling on unmount', async () => {
    jest.useFakeTimers()
    try {
        mockLocal = { state: 'setting_up', reason: 'residence_address_in_review' }
        const { unmount } = render(tree())
        for (let attempt = 0; attempt < 30; attempt++) {
            await act(async () => {
                jest.advanceTimersByTime(15_000)
                await Promise.resolve()
            })
        }
        expect(mockFetchUser).toHaveBeenCalledTimes(24)
        blocked()
        unmount()
        await act(async () => {
            jest.advanceTimersByTime(60_000)
        })
        expect(mockFetchUser).toHaveBeenCalledTimes(24)
    } finally {
        jest.useRealTimers()
    }
})

it('does not overlap refresh requests or keep polling after unmount', async () => {
    jest.useFakeTimers()
    let finish: () => void = () => {}
    mockFetchUser.mockImplementationOnce(
        () =>
            new Promise<null>((resolve) => {
                finish = () => resolve(null)
            })
    )
    try {
        mockLocal = { state: 'setting_up', reason: 'residence_address_in_review' }
        const { unmount } = render(tree())
        await act(async () => {
            jest.advanceTimersByTime(15_000)
        })
        expect(mockFetchUser).toHaveBeenCalledTimes(1)
        await act(async () => {
            jest.advanceTimersByTime(60_000)
        })
        expect(mockFetchUser).toHaveBeenCalledTimes(1)
        blocked()
        unmount()
        await act(async () => {
            finish()
            await Promise.resolve()
        })
        act(() => {
            jest.advanceTimersByTime(60_000)
        })
        expect(mockFetchUser).toHaveBeenCalledTimes(1)
    } finally {
        jest.useRealTimers()
    }
})
