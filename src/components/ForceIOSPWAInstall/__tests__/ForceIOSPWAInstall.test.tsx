import { fireEvent, screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import ForceIOSPWAInstall from '../index'

const mockSetShowIosPwaInstallScreen = jest.fn()

jest.mock('@/hooks/useIosPwaInstallGate', () => ({
    useIosPwaInstallGate: () => ({
        showIosPwaInstallScreen: true,
        setShowIosPwaInstallScreen: mockSetShowIosPwaInstallScreen,
    }),
}))

jest.mock('@/hooks/useGetBrowserType', () => ({
    useGetBrowserType: () => ({ browserType: 'safari', isLoading: false }),
    BrowserType: { CHROME: 'chrome', EDGE: 'edge', BRAVE: 'brave', OPERA: 'opera', SAFARI: 'safari' },
}))

describe('ForceIOSPWAInstall', () => {
    beforeEach(() => jest.clearAllMocks())

    it('offers a way off the screen — it is an install nudge, not a trap', () => {
        renderWithIntl(<ForceIOSPWAInstall />)

        fireEvent.click(screen.getByRole('button', { name: /continue in the browser/i }))

        expect(mockSetShowIosPwaInstallScreen).toHaveBeenCalledWith(false)
    })
})
