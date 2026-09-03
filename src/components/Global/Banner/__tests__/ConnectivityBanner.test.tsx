import { render } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { Banner } from '../index'
import { ConnectivityToast } from '../ConnectivityToast'
import en from '@/i18n/app/messages/en.json'

jest.mock('next/navigation', () => ({
    usePathname: () => '/home',
}))

const mockConnectivity = jest.fn()
jest.mock('@/hooks/useConnectivity', () => ({
    useConnectivity: () => mockConnectivity(),
}))

const toastFn = jest.fn()
const dismissFn = jest.fn()
jest.mock('@/components/0_Bruddle/Toast', () => ({
    useToast: () => ({ toast: toastFn, dismiss: dismissFn }),
}))

beforeEach(() => {
    toastFn.mockClear()
    dismissFn.mockClear()
})

// connectivity moved from the top-of-shell banner to the toast surface
// (ruled 2026-09-03) — same messages, same states, new channel
describe('ConnectivityToast', () => {
    it('pushes a persistent error toast when the device is offline', () => {
        mockConnectivity.mockReturnValue({ show: true, isOffline: true })
        render(<ConnectivityToast />)
        expect(toastFn).toHaveBeenCalledWith(
            expect.objectContaining({
                id: 'connectivity',
                duration: 'persistent',
                type: 'error',
                message: expect.stringMatching(/no internet connection/i),
            })
        )
    })

    it('pushes a warning toast (not error, no support mention) on a timeout', () => {
        mockConnectivity.mockReturnValue({ show: true, isOffline: false })
        render(<ConnectivityToast />)
        expect(toastFn).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'warning',
                message: expect.stringMatching(/trouble reaching peanut/i),
            })
        )
        expect(toastFn.mock.calls[0][0].message).not.toMatch(/support/i)
    })

    it('dismisses the toast and pushes nothing when connectivity is fine', () => {
        mockConnectivity.mockReturnValue({ show: false, isOffline: false })
        render(<ConnectivityToast />)
        expect(dismissFn).toHaveBeenCalledWith('connectivity')
        expect(toastFn).not.toHaveBeenCalled()
    })
})

describe('Banner after the connectivity move', () => {
    it('renders nothing when no maintenance flag is on — connectivity no longer renders here', () => {
        const { container } = render(
            <NextIntlClientProvider locale="en" messages={en}>
                <Banner />
            </NextIntlClientProvider>
        )
        expect(container).toBeEmptyDOMElement()
    })
})
