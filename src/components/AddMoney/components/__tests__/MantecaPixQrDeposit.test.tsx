/**
 * MantecaPixQrDeposit — the BRL dynamic-PIX-QR screen.
 *
 * One `code` string drives both the QR and the copy button; a live countdown is
 * derived from `expiresAt`; polling flips the screen to a success state. Nested
 * primitives are stubbed so only this component's own logic is under test.
 */
import React from 'react'
import { render, screen } from '@testing-library/react'

const mockUseMantecaDepositPolling = jest.fn()
jest.mock('@/components/AddMoney/hooks/useMantecaDepositPolling', () => ({
    useMantecaDepositPolling: (...args: unknown[]) => mockUseMantecaDepositPolling(...args),
}))

jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => <div /> }))
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

// eslint-disable-next-line import/first -- must come after jest.mock
import MantecaPixQrDeposit from '../MantecaPixQrDeposit'

const basePix = {
    type: 'QR' as const,
    code: '00020126-COPIA-E-COLA',
    url: 'https://widget-qa.manteca.dev/qr?code=x',
    bankId: 'bank-1',
    expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(), // 5 min out
}

beforeEach(() => {
    mockUseMantecaDepositPolling.mockReset()
    mockUseMantecaDepositPolling.mockReturnValue({ status: 'pending' })
})

describe('MantecaPixQrDeposit', () => {
    it('renders the QR + copy from the same `code`, the amount, and a live countdown', () => {
        render(
            <MantecaPixQrDeposit pixDeposit={basePix} currencyAmount="10" onBack={jest.fn()} onComplete={jest.fn()} />
        )
        expect(screen.getByTestId('qr')).toHaveAttribute('data-url', basePix.code)
        expect(screen.getByTestId('copy')).toHaveAttribute('data-text', basePix.code)
        expect(screen.getByText('R$ 10')).toBeInTheDocument()
        expect(screen.getByText(/Expires in/)).toBeInTheDocument()
    })

    it('shows the expired state (QR disabled, no countdown) once expiresAt has passed', () => {
        const expired = { ...basePix, expiresAt: new Date(Date.now() - 1000).toISOString() }
        render(<MantecaPixQrDeposit pixDeposit={expired} onBack={jest.fn()} onComplete={jest.fn()} />)

        expect(screen.getByText(/expired/i)).toBeInTheDocument()
        expect(screen.getByTestId('qr')).toHaveAttribute('data-disabled', 'true')
        expect(screen.queryByText(/Expires in/)).not.toBeInTheDocument()
    })

    it('shows the success state when the deposit completes', () => {
        mockUseMantecaDepositPolling.mockReturnValue({ status: 'completed' })
        render(<MantecaPixQrDeposit pixDeposit={basePix} onBack={jest.fn()} onComplete={jest.fn()} />)

        expect(screen.getByText('Deposit received!')).toBeInTheDocument()
        expect(screen.queryByTestId('qr')).not.toBeInTheDocument()
    })
})
