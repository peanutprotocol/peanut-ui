import { act, screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import en from '@/i18n/app/messages/en.json'
import { PAYMENT_LOADING_WORD_KEYS } from '@/components/Global/Loading/words'
import { QrPayProcessingView } from '../views/QrPayProcessingView'

jest.mock('@/components/Global/Loading', () => ({
    __esModule: true,
    default: () => <div data-testid="mascot-loader" />,
}))

const CAPTIONS = PAYMENT_LOADING_WORD_KEYS.map((key) => `${en.paymentLoading[key]}...`)

const shownCaption = () => screen.getByText((text) => CAPTIONS.includes(text)).textContent

describe('QrPayProcessingView', () => {
    beforeEach(() => jest.useFakeTimers())
    afterEach(() => {
        jest.useRealTimers()
        jest.restoreAllMocks()
    })

    it('shows the title and a payment word under it', () => {
        renderWithIntl(<QrPayProcessingView />)

        expect(screen.getByText(en.qrPay.processingPaymentTitle)).toBeInTheDocument()
        expect(CAPTIONS).toContain(shownCaption())
    })

    it('shows a different word every 1.8 seconds while the payment processes', () => {
        renderWithIntl(<QrPayProcessingView />)
        const seen = [shownCaption()]

        for (let tick = 0; tick < 5; tick++) {
            act(() => jest.advanceTimersByTime(1800))
            const caption = shownCaption()
            expect(CAPTIONS).toContain(caption)
            expect(caption).not.toBe(seen[seen.length - 1])
            seen.push(caption)
        }
    })

    it('keeps the word until 1.8 seconds have passed', () => {
        renderWithIntl(<QrPayProcessingView />)
        const first = shownCaption()

        act(() => jest.advanceTimersByTime(1799))

        expect(shownCaption()).toBe(first)
    })

    it('stops rotating once the screen is gone', () => {
        const { unmount } = renderWithIntl(<QrPayProcessingView />)

        unmount()

        expect(jest.getTimerCount()).toBe(0)
    })
})
