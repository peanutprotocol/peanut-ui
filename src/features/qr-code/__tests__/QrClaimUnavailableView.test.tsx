import { fireEvent, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import en from '@/i18n/app/messages/en.json'
import { QrClaimUnavailableView } from '../views/QrClaimUnavailableView'

const push = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
jest.mock('@/components/Global/NavHeader', () => () => null)
jest.mock('@/components/Global/PeanutMascot', () => ({
    __esModule: true,
    default: ({ pose, alt }: { pose: string; alt?: string }) => (
        <div data-testid="mascot" data-pose={pose} aria-hidden={!alt} />
    ),
}))

describe('QrClaimUnavailableView', () => {
    beforeEach(() => push.mockClear())

    it.each([
        [false, 'This QR code is not available for claiming.'],
        [true, 'This QR code has already been claimed by another user.'],
    ])('shows the error and home action when alreadyClaimed is %s', (alreadyClaimed, description) => {
        render(
            <NextIntlClientProvider locale="en" messages={en} timeZone="UTC">
                <QrClaimUnavailableView shakeClass="" alreadyClaimed={alreadyClaimed} />
            </NextIntlClientProvider>
        )

        const heading = screen.getByRole('heading', { name: 'QR code unavailable' })
        const card = heading.closest('.border')
        expect(card).not.toBeNull()
        expect(card).toHaveTextContent(description)
        expect(card?.querySelector('.bg-background-icon-bubble-red svg')).not.toBeNull()
        const mascot = screen.getByTestId('mascot')
        expect(mascot).toHaveAttribute('data-pose', 'sad')
        expect(mascot).toHaveAttribute('aria-hidden', 'true')
        expect(card).not.toContainElement(mascot)
        expect(mascot.compareDocumentPosition(card!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
        fireEvent.click(screen.getByRole('button', { name: 'Go to Home' }))
        expect(push).toHaveBeenCalledWith('/home')
    })
})
