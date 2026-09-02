import { renderHook, waitFor } from '@testing-library/react'
import { useAppVersion } from '../useAppVersion'

const mockGetBinaryInfo = jest.fn()
// Only the bridge call is stubbed — the formatter runs for real, so the shape
// the About screen renders is exercised end to end.
jest.mock('@/utils/app-version', () => ({
    ...jest.requireActual('@/utils/app-version'),
    getBinaryInfo: () => mockGetBinaryInfo(),
}))

describe('useAppVersion', () => {
    beforeEach(() => jest.clearAllMocks())

    it('reports what the binary ships, not what package.json says', async () => {
        // package.json no longer tracks releases — the release workflow stamps
        // MARKETING_VERSION, which is how a 1.1.0 build reported 1.0.53.
        mockGetBinaryInfo.mockResolvedValue({ appVersion: '1.1.0', appBuild: '412' })

        const { result } = renderHook(() => useAppVersion('1.0.53'))

        // the build number takes the patch position — it is the digit that moves
        await waitFor(() => expect(result.current).toBe('1.1.412'))
    })

    it('keeps the bundled version on web, where there is no binary to ask', async () => {
        mockGetBinaryInfo.mockResolvedValue(null)

        const { result } = renderHook(() => useAppVersion('1.0.53'))

        await waitFor(() => expect(mockGetBinaryInfo).toHaveBeenCalled())
        expect(result.current).toBe('1.0.53')
    })
})
