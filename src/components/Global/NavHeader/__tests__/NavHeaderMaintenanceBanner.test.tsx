import { render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import NavHeader from '../index'
import en from '@/i18n/app/messages/en.json'

const mockPathname = jest.fn()
jest.mock('next/navigation', () => ({
    usePathname: () => mockPathname(),
}))

jest.mock('@/hooks/useConnectivity', () => ({
    useConnectivity: () => ({ show: false, isOffline: false }),
}))

const mockConfig = {
    enableFullMaintenance: false,
    enableMaintenanceBanner: false,
    maintenanceBannerPaths: [] as string[],
}
jest.mock('@/config/underMaintenance.config', () => ({
    __esModule: true,
    get default() {
        return mockConfig
    },
}))

const renderNavHeader = () =>
    render(
        <NextIntlClientProvider locale="en" messages={en}>
            <NavHeader title="Your card" />
        </NextIntlClientProvider>
    )

// placement ruling 2026-09-03: feature maintenance banners render BELOW the
// page's nav header — NavHeader mounts the Banner, so every page with a nav
// header carries it in the right spot for free
describe('NavHeader maintenance banner placement', () => {
    beforeEach(() => {
        mockConfig.enableFullMaintenance = false
        mockConfig.enableMaintenanceBanner = false
        mockConfig.maintenanceBannerPaths = []
        mockPathname.mockReturnValue('/card')
    })

    it('renders no banner outside maintenance mode', () => {
        renderNavHeader()
        expect(screen.queryByText(en.global.maintenanceBody)).not.toBeInTheDocument()
    })

    it('renders the feature maintenance banner (title + body) after the header row', () => {
        mockConfig.enableMaintenanceBanner = true
        renderNavHeader()
        expect(screen.getByText(en.global.maintenanceTitle)).toBeInTheDocument()
        const backButton = screen.getByTestId('nav-back')
        const banner = screen.getByText(en.global.maintenanceBody)
        // DOCUMENT_POSITION_FOLLOWING: the banner comes after the header row
        expect(backButton.compareDocumentPosition(banner) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })
})
