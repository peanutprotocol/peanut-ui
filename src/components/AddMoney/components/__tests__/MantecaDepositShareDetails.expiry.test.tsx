import React from 'react'
import { act, fireEvent, screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import MantecaDepositShareDetails from '../MantecaDepositShareDetails'
import type { MantecaDepositResponseData } from '@/types/manteca.types'

jest.mock('next/navigation', () => ({
    useParams: () => ({ country: 'argentina' }),
}))
jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Profile/AvatarWithBadge', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Provider/ProviderHelp', () => ({ ProviderHelp: () => null }))
jest.mock('@/components/Global/ShareButton', () => ({
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
}))
jest.mock('@/components/Global/CopyToClipboard', () => ({ __esModule: true, default: () => null }))

const NOW = Date.parse('2026-11-27T12:00:00Z')

// an ARS 10.000 order whose CVU lapses 90 s from now
const order = {
    details: {
        depositAddress: '0000003100000000000001',
        depositAlias: 'peanut.alias',
        price: '1000',
        withdrawCostInAsset: '0.001',
    },
    stages: {
        '1': { thresholdAmount: '10000', asset: 'ARS', expireAt: new Date(NOW + 90_000).toISOString() },
        '3': { amount: '10' },
    },
} as unknown as MantecaDepositResponseData

const EXPIRED_COPY = 'This deposit order expired. Already sent money? Contact support.'

beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(NOW)
})
afterEach(() => jest.useRealTimers())

describe('the order countdown', () => {
    it('counts down, holds a checking state at zero, and offers a new order only once the API says expired', () => {
        const onStartOver = jest.fn()
        const onContactSupport = jest.fn()
        const props = {
            depositDetails: order,
            onBack: jest.fn(),
            onDone: jest.fn(),
            onStartOver,
            onContactSupport,
        }
        const { rerender } = renderWithIntl(<MantecaDepositShareDetails {...props} arsStatus="pending" />)
        expect(screen.getByText('Valid for')).toBeInTheDocument()
        expect(screen.getByText('1:30')).toBeInTheDocument()
        // the CVU shows its first 10 and last 4 digits in the compact row
        expect(screen.getByText('0000003100 … 0001')).toBeInTheDocument()

        act(() => jest.advanceTimersByTime(60_000))
        expect(screen.getByText('0:30')).toBeInTheDocument()

        // the clock ran out but the poll still says pending: a transfer may be in flight, so the details
        // go away and no new order is offered (a new one would cancel this one)
        act(() => jest.advanceTimersByTime(31_000))
        expect(screen.getByText('Checking the order')).toBeInTheDocument()
        expect(screen.queryByText('Share details')).not.toBeInTheDocument()
        expect(screen.queryByText('0000003100 … 0001')).not.toBeInTheDocument()
        expect(screen.queryByText(EXPIRED_COPY)).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Start a new deposit' })).not.toBeInTheDocument()

        // the API confirms the provider cancelled it unpaid: now the expired card and the way on
        rerender(<MantecaDepositShareDetails {...props} arsStatus="expired" />)
        expect(screen.getByText(EXPIRED_COPY)).toBeInTheDocument()
        expect(screen.getByText('ARS 10,000')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Contact support' }))
        expect(onContactSupport).toHaveBeenCalledTimes(1)
        fireEvent.click(screen.getByRole('button', { name: 'Start a new deposit' }))
        expect(onStartOver).toHaveBeenCalledTimes(1)
    })

    it('lets a late payment win over the lapsed clock', () => {
        const props = { depositDetails: order, onBack: jest.fn(), onDone: jest.fn(), onStartOver: jest.fn() }
        const { rerender } = renderWithIntl(<MantecaDepositShareDetails {...props} arsStatus="pending" />)
        act(() => jest.advanceTimersByTime(91_000))
        expect(screen.getByText('Checking the order')).toBeInTheDocument()

        rerender(<MantecaDepositShareDetails {...props} arsStatus="processing" />)
        expect(screen.getByText('Payment received')).toBeInTheDocument()
        expect(screen.queryByText('Checking the order')).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Start a new deposit' })).not.toBeInTheDocument()
    })

    it('never expires an order whose transfer already arrived', () => {
        renderWithIntl(
            <MantecaDepositShareDetails
                depositDetails={order}
                arsStatus="processing"
                onBack={jest.fn()}
                onDone={jest.fn()}
            />
        )
        act(() => jest.advanceTimersByTime(120_000))
        expect(screen.queryByText(EXPIRED_COPY)).not.toBeInTheDocument()
        // no live order, no timer
        expect(screen.queryByText('Valid for')).not.toBeInTheDocument()
    })
})

it('folds the rate, fees and arrival under one row with unchanged values, and keeps the provider named', () => {
    renderWithIntl(
        <MantecaDepositShareDetails depositDetails={order} arsStatus="pending" onBack={jest.fn()} onDone={jest.fn()} />
    )
    expect(screen.queryByText('Exchange rate')).not.toBeInTheDocument()
    // money goes to the provider from this screen: it stays named outside the fold (Resolution 520)
    expect(screen.getByText('Provider · Manteca')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Rate, fees and arrival' }))

    // label → value, exactly as the unfolded screen on dev prints them (the Peanut fee row left with TASK-25349)
    const rows: [string, string][] = [
        ['Exchange rate', '1 USD = 1,000.00 ARS'],
        ['Provider fees', '< 0.01 USD'],
        ['Arrives', 'Usually within minutes'],
    ]
    for (const [label, value] of rows) {
        expect(screen.getByText(label)).toBeInTheDocument()
        expect(screen.getByText(value)).toBeInTheDocument()
    }
    // the header still shows the order minus the provider fee, as before
    expect(screen.getByText('10 USD')).toBeInTheDocument()
})

it('"I\'ve sent the transfer" hands control back to the flow', () => {
    const onSent = jest.fn()
    renderWithIntl(
        <MantecaDepositShareDetails
            depositDetails={order}
            arsStatus="pending"
            onBack={jest.fn()}
            onDone={jest.fn()}
            onSent={onSent}
        />
    )
    fireEvent.click(screen.getByRole('button', { name: "I've sent the transfer" }))
    expect(onSent).toHaveBeenCalledTimes(1)
})

// the poll maps FAILED, REFUNDED and a CANCELLED that was not an unpaid expiry to 'failed':
// that order's CVU is dead, so nothing may invite a transfer to it
it('a failed order shows the ended card, never the dead CVU, Share or "I\'ve sent the transfer"', () => {
    const onStartOver = jest.fn()
    const onContactSupport = jest.fn()
    renderWithIntl(
        <MantecaDepositShareDetails
            depositDetails={order}
            arsStatus="failed"
            onBack={jest.fn()}
            onDone={jest.fn()}
            onSent={jest.fn()}
            onStartOver={onStartOver}
            onContactSupport={onContactSupport}
        />
    )
    expect(
        screen.getByText('This deposit order did not go through. Already sent money? Contact support.')
    ).toBeInTheDocument()
    expect(screen.getByText('ARS 10,000')).toBeInTheDocument()
    expect(screen.queryByText('0000003100 … 0001')).not.toBeInTheDocument()
    expect(screen.queryByText('Share details')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: "I've sent the transfer" })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Contact support' }))
    expect(onContactSupport).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Start a new deposit' }))
    expect(onStartOver).toHaveBeenCalledTimes(1)
})
