import React from 'react'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import type { JourneyState } from '../types'
import NextPaymentCard from '../surfaces/zone/NextPaymentCard'

const mockPush = jest.fn()
const mockOpenScanner = jest.fn()
let mockState: Pick<JourneyState, 'qr' | 'cardOffer'>
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))
jest.mock('@/context/ModalsContext', () => ({ useModalsContext: () => ({ setIsQRScannerOpen: mockOpenScanner }) }))
jest.mock('../AttentionProvider', () => ({ useAttention: () => ({ state: mockState }) }))
jest.mock('@/components/Home/HomeCarouselCTA/CarouselCTA', () => ({
    __esModule: true,
    default: ({ title, description, onClick }: { title: string; description: string; onClick: () => void }) => (
        <button onClick={onClick}>
            <span>{title}</span>
            <span data-testid="body">{description}</span>
        </button>
    ),
}))

const paths = (qr: boolean, card: boolean | undefined) => {
    mockState = {
        qr: { canPayNow: qr, hasMadeQrPayment: true, verifyOpensQr: false },
        cardOffer: {
            loaded: true,
            geoProhibited: false,
            hasCardRelationship: card === true,
            promotionDisabled: false,
            canSpendViaCard: card,
        },
    }
}

const renderCard = () =>
    renderWithIntl(
        <NextPaymentCard
            askId="next-payment"
            mode="ask"
            onActed={jest.fn()}
            onDismissed={jest.fn()}
            onSnoozed={jest.fn()}
        />
    )

beforeEach(() => jest.clearAllMocks())

// D1: the body promises only the ways this user can pay.
test.each([
    ['QR and card', true, true, 'Your balance is ready. Pay with a QR code or your Peanut card.'],
    ['QR only', true, false, 'Your balance is ready. Scan a QR code to pay.'],
    ['QR only, card unknown', true, undefined, 'Your balance is ready. Scan a QR code to pay.'],
    ['card only', false, true, 'Your balance is ready. Pay with your Peanut card.'],
])('%s: keeps the title and names only the paths the user has', (_paths, qr, card, body) => {
    paths(qr, card)
    renderCard()
    expect(screen.getByText('Pay with Peanut again')).toBeInTheDocument()
    expect(screen.getByTestId('body')).toHaveTextContent(body)
    expect(screen.getByTestId('body')).not.toHaveTextContent(/tap your card/i)
})

test.each([
    ['QR and card', true, true],
    ['QR only', true, false],
])('%s: the card opens the QR scanner', (_paths, qr, card) => {
    paths(qr, card)
    renderCard()
    fireEvent.click(screen.getByRole('button'))
    expect(mockOpenScanner).toHaveBeenCalledWith(true)
    expect(mockPush).not.toHaveBeenCalled()
})

test('card only: the card opens the card screen, never the QR scanner', () => {
    paths(false, true)
    renderCard()
    fireEvent.click(screen.getByRole('button'))
    expect(mockPush).toHaveBeenCalledWith('/card')
    expect(mockOpenScanner).not.toHaveBeenCalled()
})
