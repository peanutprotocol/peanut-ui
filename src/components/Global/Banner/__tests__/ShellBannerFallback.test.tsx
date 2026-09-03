import { render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import NavHeader from '@/components/Global/NavHeader'
import { NavHeaderPresenceProvider } from '../navHeaderPresence'
import { ShellBannerFallback } from '../ShellBannerFallback'
import en from '@/i18n/app/messages/en.json'

const mockPathname = jest.fn()
jest.mock('next/navigation', () => ({
    usePathname: () => mockPathname(),
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

const renderShell = (children?: React.ReactNode) =>
    render(
        <NextIntlClientProvider locale="en" messages={en}>
            <NavHeaderPresenceProvider>
                <ShellBannerFallback />
                {children}
            </NavHeaderPresenceProvider>
        </NextIntlClientProvider>
    )

// chip finding on PR #2946: headerless app states (loading, error screens,
// guest views) must still show the configured maintenance notice — the shell
// fallback carries it exactly when no NavHeader is on screen
describe('ShellBannerFallback', () => {
    beforeEach(() => {
        mockConfig.enableFullMaintenance = false
        mockConfig.enableMaintenanceBanner = true
        mockConfig.maintenanceBannerPaths = []
        mockPathname.mockReturnValue('/card')
    })

    it('shows the maintenance banner on a headerless state', () => {
        renderShell()
        expect(screen.getByText(en.global.maintenanceBanner)).toBeInTheDocument()
    })

    it('yields to the NavHeader-mounted banner when a header is on screen', () => {
        renderShell(<NavHeader title="Your card" />)
        // exactly one banner: the NavHeader one (feature copy, below the
        // header); the shell fallback (global one-liner) stays quiet
        expect(screen.queryByText(en.global.maintenanceBanner)).not.toBeInTheDocument()
        expect(screen.getAllByText(en.global.maintenanceBody)).toHaveLength(1)
        const backButton = screen.getByTestId('nav-back')
        const banner = screen.getByText(en.global.maintenanceBody)
        expect(backButton.compareDocumentPosition(banner) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })

    it('shows nothing outside maintenance mode', () => {
        mockConfig.enableMaintenanceBanner = false
        renderShell()
        expect(screen.queryByText(en.global.maintenanceBanner)).not.toBeInTheDocument()
    })
})
