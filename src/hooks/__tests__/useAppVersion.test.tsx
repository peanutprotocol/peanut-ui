import { renderHook, waitFor } from '@testing-library/react'
import { useAppVersion } from '../useAppVersion'

const mockGetRunningVersion = jest.fn()
// Only the bridge call is stubbed — the formatter runs for real, so the shape
// the About screen renders is exercised end to end.
jest.mock('@/utils/app-version', () => ({
    ...jest.requireActual('@/utils/app-version'),
    getRunningVersion: () => mockGetRunningVersion(),
}))

describe('useAppVersion', () => {
    beforeEach(() => jest.clearAllMocks())

    it('reports what the binary ships, not what package.json says', async () => {
        // package.json no longer tracks releases — the release workflow stamps
        // MARKETING_VERSION, which is how a 1.1.0 build reported 1.0.53.
        mockGetRunningVersion.mockResolvedValue({ appVersion: '1.1.0', appBuild: '412', otaVersion: null })

        const { result } = renderHook(() => useAppVersion('1.0.53'))

        // the release version is kept whole; the CI build is a fourth segment
        await waitFor(() => expect(result.current).toBe('1.1.0.412'))
    })

    // The binary never moves past the `.0` it shipped with, so an OTA'd install
    // that still reported it would name code the user stopped running.
    it('reports the OTA bundle once one is applied', async () => {
        mockGetRunningVersion.mockResolvedValue({ appVersion: '1.1.0', appBuild: '10048', otaVersion: '1.1.2' })

        const { result } = renderHook(() => useAppVersion('1.0.53'))

        await waitFor(() => expect(result.current).toBe('1.1.2.10048'))
    })

    it('keeps the bundled version on web, where there is no binary to ask', async () => {
        mockGetRunningVersion.mockResolvedValue(null)

        const { result } = renderHook(() => useAppVersion('1.0.53'))

        await waitFor(() => expect(mockGetRunningVersion).toHaveBeenCalled())
        expect(result.current).toBe('1.0.53')
    })
})
