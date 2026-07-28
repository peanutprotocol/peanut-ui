/**
 * MantecaPixQrDeposit — the BRL dynamic-PIX-QR screen.
 *
 * One `details.depositAddresses.PIX.code` string (EMVCo copia-e-cola) drives
 * both the QR and the copy button; a live countdown is derived from
 * `details.priceExpireAt`; polling flips the screen to a success state. Nested
 * primitives are stubbed so only this component's own logic is under test.
 */
import React from 'react'
import { render as rtlRender, screen, fireEvent } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'

const render = (ui: React.ReactElement) => rtlRender(<IntlWrapper>{ui}</IntlWrapper>)

const mockUseMantecaDepositPolling = jest.fn()
jest.mock('@/components/AddMoney/hooks/useMantecaDepositPolling', () => ({
    useMantecaDepositPolling: (...args: unknown[]) => mockUseMantecaDepositPolling(...args),
}))

jest.mock('@/components/Global/NavHeader', () => ({
    __esModule: true,
    default: ({ onPrev }: { onPrev?: () => void }) => <div data-testid="nav-back" onClick={onPrev} />,
}))
jest.mock('@/components/Global/QRCodeWrapper', () => ({
    __esModule: true,
    default: ({ url, disabled }: { url: string; disabled?: boolean }) => (
        <div data-testid="qr" data-url={url} data-disabled={disabled ? 'true' : 'false'} />
    ),
}))
jest.mock('@/components/Global/CopyToClipboard', () => ({
    __esModule: true,
    default: ({ textToCopy }: { textToCopy: string }) => <div data-testid="copy" data-text={textToCopy} />,
}))
jest.mock('@/components/Global/Icons/Icon', () => ({ Icon: () => <div /> }))
jest.mock('@/components/0_Bruddle/Button', () => ({
    Button: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
        <button onClick={onClick}>{children}</button>
    ),
}))

// must come after the jest.mock calls above
import MantecaPixQrDeposit from '../MantecaPixQrDeposit'

const PIX_CODE = '00020126-COPIA-E-COLA'
const baseDeposit = {
    id: 'syn-1',
    type: 'RAMP_OPERATION' as const,
    details: {
        // prod shape confirmed 2026-07-02 — the QR rides in depositAddresses.PIX
        depositAddresses: {
            PIX: {
                type: 'QR',
                code: PIX_CODE,
                url: `https://widget.manteca.dev/qr?code=${PIX_CODE}`,
                expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60_000).toISOString(), // ~3 days out
                bankId: 'bank-1',
            },
        },
        priceExpireAt: new Date(Date.now() + 5 * 60_000).toISOString(), // 5 min out
    },
    stages: {},
} as unknown as import('@/types/manteca.types').MantecaDepositResponseData

beforeEach(() => {
    mockUseMantecaDepositPolling.mockReset()
    mockUseMantecaDepositPolling.mockReturnValue({ status: 'pending' })
})

describe('MantecaPixQrDeposit', () => {
    it('renders the QR + copy from the same PIX copia-e-cola code, the amount, and a live countdown', () => {
        render(
            <MantecaPixQrDeposit
                depositDetails={baseDeposit}
                currencyAmount="10"
                onBack={jest.fn()}
                onDone={jest.fn()}
                onComplete={jest.fn()}
            />
        )
        expect(screen.getByTestId('qr')).toHaveAttribute('data-url', PIX_CODE)
        expect(screen.getByTestId('copy')).toHaveAttribute('data-text', PIX_CODE)
        expect(screen.getByText('R$ 10')).toBeInTheDocument()
        expect(screen.getByText(/Expires in/)).toBeInTheDocument()
    })

    it('shows the expired state (QR disabled, no countdown) once priceExpireAt has passed', () => {
        const expired = {
            ...baseDeposit,
            details: { ...baseDeposit.details, priceExpireAt: new Date(Date.now() - 1000).toISOString() },
        }
        render(
            <MantecaPixQrDeposit
                depositDetails={expired}
                onBack={jest.fn()}
                onDone={jest.fn()}
                onComplete={jest.fn()}
            />
        )

        expect(screen.getByText(/expired/i)).toBeInTheDocument()
        expect(screen.getByTestId('qr')).toHaveAttribute('data-disabled', 'true')
        expect(screen.queryByText(/Expires in/)).not.toBeInTheDocument()
    })

    it('shows the success state when the deposit completes', () => {
        mockUseMantecaDepositPolling.mockReturnValue({ status: 'completed' })
        render(
            <MantecaPixQrDeposit
                depositDetails={baseDeposit}
                onBack={jest.fn()}
                onDone={jest.fn()}
                onComplete={jest.fn()}
            />
        )

        expect(screen.getByText('Deposit received!')).toBeInTheDocument()
        expect(screen.queryByTestId('qr')).not.toBeInTheDocument()
    })

    // Regression: both exits on the success screen used to call onBack, which the
    // parent wires to step=inputAmount — so "Done" started a NEW deposit.
    it('exits the flow via onDone (never onBack) from the success screen', () => {
        mockUseMantecaDepositPolling.mockReturnValue({ status: 'completed' })
        const onBack = jest.fn()
        const onDone = jest.fn()
        render(
            <MantecaPixQrDeposit depositDetails={baseDeposit} onBack={onBack} onDone={onDone} onComplete={jest.fn()} />
        )

        fireEvent.click(screen.getByText('Done'))
        fireEvent.click(screen.getByTestId('nav-back'))

        expect(onDone).toHaveBeenCalledTimes(2)
        expect(onBack).not.toHaveBeenCalled()
    })

    it('still uses onBack from the expired state — that one is a real go-back', () => {
        const onBack = jest.fn()
        const expired = {
            ...baseDeposit,
            details: { ...baseDeposit.details, priceExpireAt: new Date(Date.now() - 1000).toISOString() },
        }
        render(
            <MantecaPixQrDeposit depositDetails={expired} onBack={onBack} onDone={jest.fn()} onComplete={jest.fn()} />
        )

        fireEvent.click(screen.getByText('Go back'))
        expect(onBack).toHaveBeenCalledTimes(1)
    })
})
