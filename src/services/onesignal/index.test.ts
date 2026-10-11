let mockFailuresLeft = 0
let mockLoads = 0

jest.mock('@/utils/capacitor', () => ({ isCapacitor: () => true }))
jest.mock('./native.adapter', () => {
    mockLoads += 1
    if (mockFailuresLeft > 0) {
        mockFailuresLeft -= 1
        throw Object.assign(
            new Error('Loading chunk 9 failed.\n(timeout: capacitor://localhost/_next/static/chunks/9.js)'),
            { name: 'ChunkLoadError' }
        )
    }
    return { nativeOneSignalAdapter: { platform: 'native' } }
})

function fresh(failures: number) {
    jest.resetModules()
    mockFailuresLeft = failures
    mockLoads = 0
    return require('./index') as typeof import('./index')
}

describe('getOneSignalAdapter', () => {
    it('retries a failed adapter chunk once within the same call', async () => {
        const { getOneSignalAdapter } = fresh(1)
        await expect(getOneSignalAdapter()).resolves.toEqual({ platform: 'native' })
        expect(mockLoads).toBe(2)
    })

    it('does not keep a failed load, so the next call imports again', async () => {
        const { getOneSignalAdapter } = fresh(2)
        await expect(getOneSignalAdapter()).rejects.toMatchObject({ name: 'ChunkLoadError' })

        const adapter = getOneSignalAdapter()
        await expect(adapter).resolves.toEqual({ platform: 'native' })
        expect(getOneSignalAdapter()).toBe(adapter)
        expect(mockLoads).toBe(3)
    })
})

export {}
