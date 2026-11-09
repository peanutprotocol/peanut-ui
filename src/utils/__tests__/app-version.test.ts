jest.mock('@/utils/native-platform', () => require('@/test-utils/native-platform-mock').createNativePlatformMock())

import { formatRunningVersion, getRunningVersion } from '@/utils/app-version'

const mockGetInfo = jest.fn()
const mockCurrent = jest.fn()
jest.mock('@capacitor/app', () => ({ App: { getInfo: () => mockGetInfo() } }))
jest.mock('@capgo/capacitor-updater', () => ({ CapacitorUpdater: { current: () => mockCurrent() } }))
const mockIsCapacitor = jest.fn(() => true)
jest.mock('@/utils/capacitor', () => ({
    isCapacitor: () => mockIsCapacitor(),
    isNativeBridge: () => mockIsCapacitor(),
}))

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

    it.each([
        ['1.5.1000-ios', '1.6.9-i'],
        ['1.6.1000-android', '1.6.9-a'],
        ['1.6.9-ios', '1.6.9-i'],
    ])('shows the baked public version for %s', (otaVersion, expected) => {
        expect(formatRunningVersion({ appVersion: '1.5.0', appBuild: '21653381', otaVersion }, '1.6.9')).toBe(expected)
    })

    it('keeps the bundle identity if the public release metadata is invalid', () => {
        expect(
            formatRunningVersion(
                { appVersion: '1.5.0', appBuild: '21653381', otaVersion: '1.5.1000-ios' },
                'unexpected'
            )
        ).toBe('1.5.1000-ios')
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

describe('getCachedBinaryVersion', () => {
    function freshReader(): typeof import('@/utils/app-version').getCachedBinaryVersion {
        let read: typeof import('@/utils/app-version').getCachedBinaryVersion
        jest.isolateModules(() => {
            read = require('@/utils/app-version').getCachedBinaryVersion
        })
        return read!
    }

    beforeEach(() => {
        jest.clearAllMocks()
        mockIsCapacitor.mockReturnValue(true)
        mockGetInfo.mockReset().mockResolvedValue({ version: '1.23.0', build: '42' })
    })
    afterEach(() => jest.useRealTimers())

    it('shares and caches one native lookup across concurrent and subsequent callers', async () => {
        const read = freshReader()
        await expect(Promise.all([read(), read(), read()])).resolves.toEqual(['1.23.0', '1.23.0', '1.23.0'])
        await expect(read()).resolves.toBe('1.23.0')
        expect(mockGetInfo).toHaveBeenCalledTimes(1)
    })

    it.each(['', '1.2', '1.2.3.4', '1.2.3-ios', ' 1.2.3', '1.2.3\n', '10000.2.3', '1.2.' + '3'.repeat(10000)])(
        'omits invalid binary version %p without retry',
        async (version) => {
            mockGetInfo.mockResolvedValue({ version })
            const read = freshReader()
            await expect(read()).resolves.toBeUndefined()
            await expect(read()).resolves.toBeUndefined()
            expect(mockGetInfo).toHaveBeenCalledTimes(1)
        }
    )

    it.each(['rejected', 'thrown'])('contains a %s plugin failure without retry', async (failure) => {
        if (failure === 'rejected') mockGetInfo.mockRejectedValue(new Error('plugin unavailable'))
        else
            mockGetInfo.mockImplementation(() => {
                throw new Error('plugin unavailable')
            })
        const read = freshReader()
        await expect(read()).resolves.toBeUndefined()
        await expect(read()).resolves.toBeUndefined()
        expect(mockGetInfo).toHaveBeenCalledTimes(1)
    })

    it('never reads the binary on web', async () => {
        mockIsCapacitor.mockReturnValue(false)
        await expect(freshReader()()).resolves.toBeUndefined()
        expect(mockGetInfo).not.toHaveBeenCalled()
    })

    it('shares the original timeout budget and accepts a late valid result without retry', async () => {
        jest.useFakeTimers()
        let finish!: (value: { version: string }) => void
        mockGetInfo.mockReturnValue(
            new Promise((resolve) => {
                finish = resolve
            })
        )
        const read = freshReader()
        const first = read()
        await jest.advanceTimersByTimeAsync(200)
        const concurrent = read()
        await jest.advanceTimersByTimeAsync(110)
        await expect(first).resolves.toBeUndefined()
        await expect(concurrent).resolves.toBeUndefined()
        await expect(read()).resolves.toBeUndefined()
        expect(mockGetInfo).toHaveBeenCalledTimes(1)
        finish({ version: '1.23.0' })
        await jest.advanceTimersByTimeAsync(0)
        await expect(read()).resolves.toBe('1.23.0')
        expect(mockGetInfo).toHaveBeenCalledTimes(1)
    })
})
