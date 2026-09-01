import { render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { Banner } from '../index'
import en from '@/i18n/app/messages/en.json'

jest.mock('next/navigation', () => ({
    usePathname: () => '/home',
}))

const mockConnectivity = jest.fn()
jest.mock('@/hooks/useConnectivity', () => ({
    useConnectivity: () => mockConnectivity(),
}))

const renderBanner = () =>
    render(
        <NextIntlClientProvider locale="en" messages={en}>
            <Banner />
        </NextIntlClientProvider>
    )

describe('Banner connectivity notification', () => {
    it('tells the user they are offline when the device has no connection', () => {
        mockConnectivity.mockReturnValue({ show: true, isOffline: true })
        renderBanner()
        expect(screen.getByText(/no internet connection/i)).toBeInTheDocument()
    })

    it('tells the user we are unreachable (not to contact support) on a timeout', () => {
        mockConnectivity.mockReturnValue({ show: true, isOffline: false })
        renderBanner()
        expect(screen.getByText(/trouble reaching peanut/i)).toBeInTheDocument()
        expect(screen.queryByText(/support/i)).not.toBeInTheDocument()
    })

    it('renders nothing when connectivity is fine and no maintenance flag is on', () => {
        mockConnectivity.mockReturnValue({ show: false, isOffline: false })
        const { container } = renderBanner()
        expect(container).toBeEmptyDOMElement()
    })
})
