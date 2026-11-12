const getInfo = jest.fn()
let native = true

jest.mock('@capacitor/app', () => ({ App: { getInfo: (...args: unknown[]) => getInfo(...args) } }))
jest.mock('@/utils/capacitor', () => ({ isCapacitor: () => native }))

describe('binary version retry contract', () => {
    beforeEach(() => {
        jest.resetModules()
        getInfo.mockReset()
        native = true
    })

    const load = () => {
        let reader: typeof import('@/utils/app-version')
        jest.isolateModules(() => {
            reader = require('@/utils/app-version')
        })
        return reader!
    }

    it.each(['rejection', 'synchronous throw'])('recovers on a later direct read after a %s', async (failure) => {
        getInfo
            .mockImplementationOnce(() => {
                if (failure === 'synchronous throw') throw new Error('unavailable')
                return Promise.reject(new Error('unavailable'))
            })
            .mockResolvedValueOnce({ version: '2.3.4', build: '42' })
        const { getBinaryInfo } = load()

        await expect(getBinaryInfo()).resolves.toBeNull()
        await expect(getBinaryInfo()).resolves.toEqual({ appVersion: '2.3.4', appBuild: '42' })
        await expect(getBinaryInfo()).resolves.toEqual({ appVersion: '2.3.4', appBuild: '42' })
        expect(getInfo).toHaveBeenCalledTimes(2)
    })

    it('shares each outstanding attempt, including a retry', async () => {
        let rejectFirst!: (error: Error) => void
        let resolveRetry!: (value: { version: string; build: string }) => void
        getInfo
            .mockImplementationOnce(
                () =>
                    new Promise((_, reject) => {
                        rejectFirst = reject
                    })
            )
            .mockImplementationOnce(
                () =>
                    new Promise((resolve) => {
                        resolveRetry = resolve
                    })
            )
        const { getBinaryInfo } = load()

        const first = getBinaryInfo()
        const concurrentFirst = getBinaryInfo()
        for (let i = 0; i < 20 && !rejectFirst; i++) await Promise.resolve()
        expect(rejectFirst).toBeDefined()
        rejectFirst(new Error('unavailable'))
        await expect(Promise.all([first, concurrentFirst])).resolves.toEqual([null, null])
        const retry = getBinaryInfo()
        const concurrentRetry = getBinaryInfo()
        for (let i = 0; i < 20 && !resolveRetry; i++) await Promise.resolve()
        expect(resolveRetry).toBeDefined()
        resolveRetry({ version: '3.0', build: '9' })
        await expect(Promise.all([retry, concurrentRetry])).resolves.toEqual([
            { appVersion: '3.0', appBuild: '9' },
            { appVersion: '3.0', appBuild: '9' },
        ])
        expect(getInfo).toHaveBeenCalledTimes(2)
    })

    it('returns null on web without calling the native API', async () => {
        native = false
        const { getBinaryInfo } = load()
        await expect(getBinaryInfo()).resolves.toBeNull()
        expect(getInfo).not.toHaveBeenCalled()
    })

    it('does not repeat a failed startup read, but observes later direct success', async () => {
        getInfo.mockRejectedValueOnce(new Error('unavailable')).mockResolvedValueOnce({ version: '4.5.6', build: '6' })
        const { getBinaryInfo, getCachedBinaryVersion } = load()
        await expect(getCachedBinaryVersion()).resolves.toBeUndefined()
        await expect(getCachedBinaryVersion()).resolves.toBeUndefined()
        expect(getInfo).toHaveBeenCalledTimes(1)
        await expect(getBinaryInfo()).resolves.toEqual({ appVersion: '4.5.6', appBuild: '6' })
        await expect(getCachedBinaryVersion()).resolves.toBe('4.5.6')
        expect(getInfo).toHaveBeenCalledTimes(2)
    })

    it('bounds the startup read to 300 ms and does not start another read', async () => {
        jest.useFakeTimers()
        try {
            getInfo.mockImplementation(() => new Promise(() => {}))
            const { getCachedBinaryVersion } = load()
            const startup = getCachedBinaryVersion()
            await jest.advanceTimersByTimeAsync(300)
            await expect(startup).resolves.toBeUndefined()
            await expect(getCachedBinaryVersion()).resolves.toBeUndefined()
            expect(getInfo).toHaveBeenCalledTimes(1)
        } finally {
            jest.useRealTimers()
        }
    })
})
