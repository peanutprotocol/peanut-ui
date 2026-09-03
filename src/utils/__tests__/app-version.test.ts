import { formatBinaryVersion, formatRunningVersion, getRunningVersion } from '@/utils/app-version'

const mockGetInfo = jest.fn()
const mockCurrent = jest.fn()
jest.mock('@capacitor/app', () => ({ App: { getInfo: () => mockGetInfo() } }))
jest.mock('@capgo/capacitor-updater', () => ({ CapacitorUpdater: { current: () => mockCurrent() } }))
jest.mock('@/utils/capacitor', () => ({ isCapacitor: () => true }))

/**
 * The About screen's version line is what a support conversation starts from.
 * Peanut's release scheme is `<major>.<build>.<ota>` (scripts/release-version.mjs),
 * so all three segments are load-bearing and the CI build number is appended
 * rather than substituted for any of them.
 */
describe('formatBinaryVersion', () => {
    it('appends the CI build to the release version, replacing nothing', () => {
        expect(formatBinaryVersion({ appVersion: '1.1.0', appBuild: '34534' })).toBe('1.1.0.34534')
    })

    it('keeps the OTA counter intact', () => {
        expect(formatBinaryVersion({ appVersion: '1.1.4', appBuild: '34534' })).toBe('1.1.4.34534')
        expect(formatBinaryVersion({ appVersion: '2.17.3', appBuild: '7' })).toBe('2.17.3.7')
    })

    // Android is `10000 + run_number`, iOS is the run number: the same release
    // legitimately shows a ~10000 gap, and the format must not hide or "fix" it.
    it('shows each platform its own build number verbatim', () => {
        expect(formatBinaryVersion({ appVersion: '1.1.0', appBuild: '44534' })).toBe('1.1.0.44534')
        expect(formatBinaryVersion({ appVersion: '1.1.0', appBuild: '34534' })).toBe('1.1.0.34534')
    })

    // Never render `undefined` or a leading dot into the one number support asks for.
    it.each([
        ['', '99', '99'],
        ['1.1.0', '', '1.1.0'],
    ])('degrades cleanly when a component is missing (%s / %s)', (appVersion, appBuild, expected) => {
        expect(formatBinaryVersion({ appVersion, appBuild })).toBe(expected)
    })
})

describe('formatRunningVersion', () => {
    // The binary is frozen at the `.0` it shipped with; the OTA counter only
    // moves in the bundle, so the bundle is what names the running revision.
    it('names the OTA bundle when one is applied, keeping the binary build', () => {
        expect(formatRunningVersion({ appVersion: '1.1.0', appBuild: '10048', otaVersion: '1.1.2' })).toBe(
            '1.1.2.10048'
        )
    })

    it('falls back to the binary on the builtin bundle', () => {
        expect(formatRunningVersion({ appVersion: '1.1.0', appBuild: '10048', otaVersion: null })).toBe('1.1.0.10048')
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
