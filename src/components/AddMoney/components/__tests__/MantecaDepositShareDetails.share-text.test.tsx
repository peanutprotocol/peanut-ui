import React from 'react'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import MantecaDepositShareDetails from '../MantecaDepositShareDetails'
import type { MantecaDepositResponseData } from '@/types/manteca.types'

const mockShare = jest.fn()

jest.mock('next/navigation', () => ({
    useParams: () => ({ country: 'argentina' }),
}))
jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Payment/PaymentInfoRow', () => ({ PaymentInfoRow: () => null }))
jest.mock('@/components/Profile/AvatarWithBadge', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Provider/ProviderHelp', () => ({ ProviderHelp: () => null }))
jest.mock('@/components/Global/ShareButton', () => ({
    __esModule: true,
    default: ({ generateText }: { generateText: () => Promise<string> }) => (
        <button onClick={async () => mockShare(await generateText())}>Share</button>
    ),
}))

const deposit = {
    details: {
        depositAddress: '0000003100000000000001',
        depositAlias: 'peanut.alias',
        price: '1200',
        withdrawCostInAsset: '0.001',
    },
    stages: { '1': { thresholdAmount: '10000', asset: 'ARS' }, '3': { amount: '8.3' } },
} as unknown as MantecaDepositResponseData

it('the shared transfer details say to send only from an account in the user’s name', async () => {
    renderWithIntl(<MantecaDepositShareDetails depositDetails={deposit} onBack={jest.fn()} />)

    expect(screen.getByText('Send only from an account in your name')).toBeTruthy()
    fireEvent.click(screen.getByText('Share'))
    await waitFor(() => expect(mockShare).toHaveBeenCalled())

    const text = mockShare.mock.calls[0][0] as string
    expect(text).toContain('0000003100000000000001')
    expect(text.split('\n').at(-1)).toBe(
        "Send it only from a bank account in my name. Transfers from someone else's account can't be credited."
    )
})

it('shows the expired order without sharing the old account details', () => {
    const onStartOver = jest.fn()
    renderWithIntl(
        <MantecaDepositShareDetails
            depositDetails={deposit}
            onBack={jest.fn()}
            arsStatus="expired"
            onStartOver={onStartOver}
        />
    )
    expect(screen.getByText('Deposit order expired')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Share' })).not.toBeInTheDocument()
    expect(onStartOver).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Start a new deposit' }))
    expect(onStartOver).toHaveBeenCalledTimes(1)
})
