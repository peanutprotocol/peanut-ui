import { formatRunningVersion, getRunningVersion } from '@/utils/app-version'

const mockGetInfo = jest.fn()
const mockCurrent = jest.fn()
jest.mock('@capacitor/app', () => ({ App: { getInfo: () => mockGetInfo() } }))
jest.mock('@capgo/capacitor-updater', () => ({ CapacitorUpdater: { current: () => mockCurrent() } }))
jest.mock('@/utils/capacitor', () => ({ isCapacitor: () => true }))

/**
 * The About screen's version line is what a support conversation starts from.
 * Peanut's release scheme is `<major>.<build>.<ota>` (scripts/release-version.mjs),
 * so all three segments are load-bearing. The platform build is a separate
 * diagnostic identifier and must not become a fourth release-version segment.
 */
describe('formatRunningVersion', () => {
    // The binary is frozen at the `.0` it shipped with; the OTA counter only
    // moves in the bundle, so the bundle is what names the running revision.
    it('names the OTA bundle when one is applied', () => {
        expect(formatRunningVersion({ appVersion: '1.5.0', appBuild: '21653381', otaVersion: '1.5.1' })).toBe('1.5.1')
    })

    it('falls back to the binary on the builtin bundle', () => {
        expect(formatRunningVersion({ appVersion: '1.5.0', appBuild: '21653381', otaVersion: null })).toBe('1.5.0')
    })

    it('keeps an automatic staging bundle version intact', () => {
        expect(formatRunningVersion({ appVersion: '1.5.0', appBuild: '21653381', otaVersion: '1.5.11715' })).toBe(
            '1.5.11715'
        )
    })
})

describe('getRunningVersion', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockGetInfo.mockResolvedValue({ version: '1.1.0', build: '10048' })
    })

    it('reads the running bundle version off the updater', async () => {
        mockCurrent.mockResolvedValue({ bundle: { id: 'abc', version: '1.1.2' } })

        await expect(getRunningVersion()).resolves.toEqual({
            appVersion: '1.1.0',
            appBuild: '10048',
            otaVersion: '1.1.2',
        })
    })

    // Capgo echoes the native version for builtin on some plugin versions and
    // the literal "builtin" on others; neither beats App.getInfo().
    it.each([
        ['builtin', '1.1.0'],
        ['abc', 'builtin'],
    ])('ignores the builtin bundle (id %s / version %s)', async (id, version) => {
        mockCurrent.mockResolvedValue({ bundle: { id, version } })

        await expect(getRunningVersion()).resolves.toMatchObject({ otaVersion: null })
    })

    // An install with no OTA layer still has to report its binary.
    it('keeps the binary when the updater cannot answer', async () => {
        mockCurrent.mockRejectedValue(new Error('plugin not implemented'))

        await expect(getRunningVersion()).resolves.toMatchObject({ appVersion: '1.1.0', otaVersion: null })
    })
})
