import React from 'react'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import ConfirmWithdrawView from '../ConfirmWithdrawView'

jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/PeanutActionDetailsCard', () => ({
    __esModule: true,
    default: ({ amount }: { amount: string }) => <div data-testid="spend-amount">{amount}</div>,
}))
jest.mock('@/components/Global/AddressLink', () => ({
    __esModule: true,
    default: ({ address }: { address: string }) => <span>{address}</span>,
}))
jest.mock('@/components/Global/DisplayIcon', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/0_Bruddle/Button', () => ({
    Button: ({
        children,
        disabled,
        onClick,
    }: {
        children: React.ReactNode
        disabled?: boolean
        onClick: () => void
    }) => (
        <button disabled={disabled} onClick={onClick}>
            {children}
        </button>
    ),
}))
jest.mock('@/hooks/useTokenChainIcons', () => ({
    useTokenChainIcons: () => ({ resolvedChainName: 'Solana', resolvedTokenSymbol: 'USDC' }),
}))

const BALANCE_WARNING = 'Not enough balance. Add funds to continue.'
const BOOKKEEPING_ERROR = 'The transfer completed, but Peanut could not record it.'

const baseProps = {
    amount: '10',
    token: { address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', symbol: 'USDC', decimals: 6, price: 1 } as never,
    chain: { chainId: 'solana', networkName: 'Solana' } as never,
    toAddress: '11111111111111111111111111111111',
    onConfirm: jest.fn(),
    onBack: jest.fn(),
    isProcessing: false,
    insufficientBalance: false,
    alreadySpent: false,
    error: null,
    isFromSendFlow: false,
    isCrossChain: true,
    receiveAmount: '10',
    payAmount: '10',
}

describe('ConfirmWithdrawView — processing balance gate', () => {
    it.each([
        { isProcessing: false, alreadySpent: false, insufficientBalance: false, warning: false, disabled: false },
        { isProcessing: false, alreadySpent: false, insufficientBalance: true, warning: true, disabled: true },
        { isProcessing: false, alreadySpent: true, insufficientBalance: false, warning: false, disabled: false },
        { isProcessing: false, alreadySpent: true, insufficientBalance: true, warning: false, disabled: false },
        { isProcessing: true, alreadySpent: false, insufficientBalance: false, warning: false, disabled: true },
        { isProcessing: true, alreadySpent: false, insufficientBalance: true, warning: false, disabled: true },
        { isProcessing: true, alreadySpent: true, insufficientBalance: false, warning: false, disabled: true },
        { isProcessing: true, alreadySpent: true, insufficientBalance: true, warning: false, disabled: true },
    ])(
        'isProcessing=$isProcessing alreadySpent=$alreadySpent insufficientBalance=$insufficientBalance',
        ({ isProcessing, alreadySpent, insufficientBalance, warning, disabled }) => {
            const onConfirm = jest.fn()
            renderWithIntl(
                <ConfirmWithdrawView
                    {...baseProps}
                    onConfirm={onConfirm}
                    isProcessing={isProcessing}
                    alreadySpent={alreadySpent}
                    insufficientBalance={insufficientBalance}
                />
            )

            const cta = screen.getByRole('button')
            expect(screen.queryByText(BALANCE_WARNING) !== null).toBe(warning)
            expect(cta).toHaveProperty('disabled', disabled)

            fireEvent.click(cta)
            expect(onConfirm).toHaveBeenCalledTimes(disabled ? 0 : 1)
        }
    )

    it('hides a newly observed low balance throughout processing and rejects duplicate clicks', () => {
        const onConfirm = jest.fn()
        const view = renderWithIntl(<ConfirmWithdrawView {...baseProps} onConfirm={onConfirm} />)

        const initialCta = screen.getByRole('button', { name: /withdraw/i })
        expect(initialCta).toBeEnabled()
        expect(screen.queryByText(BALANCE_WARNING)).not.toBeInTheDocument()

        view.rerender(<ConfirmWithdrawView {...baseProps} onConfirm={onConfirm} isProcessing insufficientBalance />)

        const processingCta = screen.getByRole('button')
        expect(processingCta).toBeDisabled()
        expect(screen.queryByText(BALANCE_WARNING)).not.toBeInTheDocument()
        fireEvent.click(processingCta)
        fireEvent.click(processingCta)
        expect(onConfirm).not.toHaveBeenCalled()
    })

    it('keeps the balance warning hidden after funds moved and exposes record-only recovery', () => {
        const onConfirm = jest.fn()
        const view = renderWithIntl(
            <ConfirmWithdrawView {...baseProps} onConfirm={onConfirm} isProcessing insufficientBalance />
        )

        expect(screen.queryByText(BALANCE_WARNING)).not.toBeInTheDocument()

        view.rerender(
            <ConfirmWithdrawView
                {...baseProps}
                onConfirm={onConfirm}
                insufficientBalance
                alreadySpent
                error={BOOKKEEPING_ERROR}
            />
        )

        expect(screen.queryByText(BALANCE_WARNING)).not.toBeInTheDocument()
        expect(screen.getByText(BOOKKEEPING_ERROR)).toBeInTheDocument()
        const retry = screen.getByRole('button', { name: /retry/i })
        expect(retry).toBeEnabled()
        fireEvent.click(retry)
        expect(onConfirm).toHaveBeenCalledTimes(1)
    })

    it('shows a recording error during processing but keeps Retry disabled against duplicate clicks', () => {
        const onConfirm = jest.fn()
        renderWithIntl(
            <ConfirmWithdrawView
                {...baseProps}
                onConfirm={onConfirm}
                isProcessing
                insufficientBalance
                alreadySpent
                error={BOOKKEEPING_ERROR}
            />
        )

        expect(screen.getByText(BOOKKEEPING_ERROR)).toBeInTheDocument()
        expect(screen.queryByText(BALANCE_WARNING)).not.toBeInTheDocument()
        const retry = screen.getByRole('button', { name: /retry/i })
        expect(retry).toBeDisabled()
        fireEvent.click(retry)
        fireEvent.click(retry)
        expect(onConfirm).not.toHaveBeenCalled()
    })

    it('restores the warning and keeps confirmation blocked after an unsuccessful attempt', () => {
        const onConfirm = jest.fn()
        const view = renderWithIntl(
            <ConfirmWithdrawView {...baseProps} onConfirm={onConfirm} isProcessing insufficientBalance />
        )

        expect(screen.queryByText(BALANCE_WARNING)).not.toBeInTheDocument()

        view.rerender(<ConfirmWithdrawView {...baseProps} onConfirm={onConfirm} insufficientBalance />)

        expect(screen.getByText(BALANCE_WARNING)).toBeInTheDocument()
        const cta = screen.getByRole('button', { name: /withdraw/i })
        expect(cta).toBeDisabled()
        fireEvent.click(cta)
        expect(onConfirm).not.toHaveBeenCalled()
    })

    it('shows and enforces the pre-execution balance gate in Send framing', () => {
        const onConfirm = jest.fn()
        renderWithIntl(<ConfirmWithdrawView {...baseProps} onConfirm={onConfirm} isFromSendFlow insufficientBalance />)

        expect(screen.getByText(BALANCE_WARNING)).toBeInTheDocument()
        const send = screen.getByRole('button', { name: /send/i })
        expect(send).toBeDisabled()
        fireEvent.click(send)
        expect(onConfirm).not.toHaveBeenCalled()
    })
})
