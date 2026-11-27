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
    it('counts down in the "Valid for" row, then switches to the expired card when time runs out', () => {
        const onStartOver = jest.fn()
        const onContactSupport = jest.fn()
        renderWithIntl(
            <MantecaDepositShareDetails
                depositDetails={order}
                arsStatus="pending"
                onBack={jest.fn()}
                onStartOver={onStartOver}
                onContactSupport={onContactSupport}
            />
        )
        expect(screen.getByText('Valid for')).toBeInTheDocument()
        expect(screen.getByText('1:30')).toBeInTheDocument()
        expect(screen.queryByText(EXPIRED_COPY)).not.toBeInTheDocument()

        act(() => jest.advanceTimersByTime(60_000))
        expect(screen.getByText('0:30')).toBeInTheDocument()

        // the poll still says pending: the clock alone ends the order on screen
        act(() => jest.advanceTimersByTime(31_000))
        expect(screen.getByText(EXPIRED_COPY)).toBeInTheDocument()
        expect(screen.getByText('ARS 10,000')).toBeInTheDocument()
        expect(screen.queryByText('Share details')).not.toBeInTheDocument()
        expect(screen.queryByText('0000003100...0000000001')).not.toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Contact support' }))
        expect(onContactSupport).toHaveBeenCalledTimes(1)
        fireEvent.click(screen.getByRole('button', { name: 'Start a new deposit' }))
        expect(onStartOver).toHaveBeenCalledTimes(1)
    })

    it('never expires an order whose transfer already arrived', () => {
        renderWithIntl(<MantecaDepositShareDetails depositDetails={order} arsStatus="processing" onBack={jest.fn()} />)
        act(() => jest.advanceTimersByTime(120_000))
        expect(screen.queryByText(EXPIRED_COPY)).not.toBeInTheDocument()
        // no live order, no timer
        expect(screen.queryByText('Valid for')).not.toBeInTheDocument()
    })
})

it('folds the rate, fees and arrival under one row with unchanged values, and keeps the provider named', () => {
    renderWithIntl(<MantecaDepositShareDetails depositDetails={order} arsStatus="pending" onBack={jest.fn()} />)
    expect(screen.queryByText('Exchange rate')).not.toBeInTheDocument()
    // money goes to the provider from this screen: it stays named outside the fold (Resolution 520)
    expect(screen.getByText('Provider · Manteca')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Rate, fees and arrival' }))

    // label → value, exactly as the screen printed them before the redesign
    const rows: [string, string][] = [
        ['Exchange rate', '1 USD = 1,000.00 ARS'],
        ['Provider fees', '< 0.01 USD'],
        ['Peanut fee', 'Sponsored by Peanut!'],
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
        <MantecaDepositShareDetails depositDetails={order} arsStatus="pending" onBack={jest.fn()} onSent={onSent} />
    )
    fireEvent.click(screen.getByRole('button', { name: "I've sent the transfer" }))
    expect(onSent).toHaveBeenCalledTimes(1)
})
