import { render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { Banner } from '../index'
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

const renderBanner = () =>
    render(
        <NextIntlClientProvider locale="en" messages={en}>
            <Banner />
        </NextIntlClientProvider>
    )

describe('Banner maintenance path targeting', () => {
    beforeEach(() => {
        mockConfig.enableFullMaintenance = false
        mockConfig.enableMaintenanceBanner = true
        mockConfig.maintenanceBannerPaths = []
    })

    it('shows on every page when no paths are configured', () => {
        mockPathname.mockReturnValue('/history')
        renderBanner()
        expect(screen.getByText(en.global.maintenanceBanner)).toBeInTheDocument()
    })

    it('shows on a targeted path and its subpaths', () => {
        mockConfig.maintenanceBannerPaths = ['/add-money']
        mockPathname.mockReturnValue('/add-money/brazil')
        renderBanner()
        expect(screen.getByText(en.global.maintenanceBanner)).toBeInTheDocument()
    })

    it('hides on a page outside the targeted paths', () => {
        mockConfig.maintenanceBannerPaths = ['/add-money']
        mockPathname.mockReturnValue('/history')
        const { container } = renderBanner()
        expect(container).toBeEmptyDOMElement()
    })

    it('full maintenance ignores path targeting', () => {
        mockConfig.enableMaintenanceBanner = false
        mockConfig.enableFullMaintenance = true
        mockConfig.maintenanceBannerPaths = ['/add-money']
        mockPathname.mockReturnValue('/history')
        renderBanner()
        expect(screen.getByText(en.global.maintenanceBanner)).toBeInTheDocument()
    })

    // designer ruling 2026-09-03: a maintenance warning on the money overview
    // reads as "funds at risk" — home never shows it, whatever the config says
    it('never shows on home, even when every page is targeted', () => {
        mockPathname.mockReturnValue('/home')
        const { container } = renderBanner()
        expect(container).toBeEmptyDOMElement()
    })

    it('never shows on home, even under full maintenance', () => {
        mockConfig.enableMaintenanceBanner = false
        mockConfig.enableFullMaintenance = true
        mockPathname.mockReturnValue('/home')
        const { container } = renderBanner()
        expect(container).toBeEmptyDOMElement()
    })
})
