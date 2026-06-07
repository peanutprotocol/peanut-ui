import { pollUntilApplyAdvances, pollUntilReady } from '@/components/Card/cardApply.utils'

const noSleep = async () => {}

describe('pollUntilApplyAdvances', () => {
    it('returns the first non-incomplete response', async () => {
        const fetchApply = jest
            .fn()
            .mockResolvedValueOnce({ status: 'incomplete', sumsubAccessToken: 't1' })
            .mockResolvedValueOnce({ status: 'incomplete', sumsubAccessToken: 't2' })
            .mockResolvedValueOnce({ status: 'terms-required', isUsResident: false })

        const result = await pollUntilApplyAdvances({
            fetchApply,
            intervalMs: 0,
            timeoutMs: 10_000,
            sleep: noSleep,
        })

        expect(result).toEqual({ status: 'terms-required', isUsResident: false })
        expect(fetchApply).toHaveBeenCalledTimes(3)
    })

    it('returns immediately when the first response advances', async () => {
        const fetchApply = jest.fn().mockResolvedValueOnce({ status: 'pending' })

        const result = await pollUntilApplyAdvances({
            fetchApply,
            intervalMs: 1000,
            timeoutMs: 10_000,
            sleep: noSleep,
        })

        expect(result).toEqual({ status: 'pending' })
        expect(fetchApply).toHaveBeenCalledTimes(1)
    })

    it('returns null once the deadline is exceeded', async () => {
        const fetchApply = jest.fn().mockResolvedValue({ status: 'incomplete', sumsubAccessToken: 't' })
        let clock = 0
        const tick = (ms: number) => {
            clock += ms
        }

        const result = await pollUntilApplyAdvances({
            fetchApply,
            intervalMs: 1000,
            timeoutMs: 3000,
            sleep: async (ms) => tick(ms),
            now: () => clock,
        })

        expect(result).toBeNull()
        // 3 polls at clock 0, 1000, 2000 — the deadline check fires after sleep #3
        expect(fetchApply).toHaveBeenCalledTimes(3)
    })

    it('propagates errors from fetchApply', async () => {
        const fetchApply = jest.fn().mockRejectedValue(new Error('network down'))

        await expect(
            pollUntilApplyAdvances({
                fetchApply,
                intervalMs: 0,
                timeoutMs: 10_000,
                sleep: noSleep,
            })
        ).rejects.toThrow('network down')

        expect(fetchApply).toHaveBeenCalledTimes(1)
    })

    it('returns null and stops polling once the signal is aborted', async () => {
        const controller = new AbortController()
        const fetchApply = jest.fn().mockImplementation(async () => {
            // abort during the second fetch so we exercise the post-fetch guard
            if (fetchApply.mock.calls.length === 2) controller.abort()
            return { status: 'incomplete', sumsubAccessToken: 't' }
        })

        const result = await pollUntilApplyAdvances({
            fetchApply,
            intervalMs: 0,
            timeoutMs: 10_000,
            signal: controller.signal,
            sleep: noSleep,
        })

        expect(result).toBeNull()
        // 1: first poll (incomplete) → sleep → check signal (aborted) → return
        // 2: second poll fired before the post-sleep check sees the abort — no third
        expect(fetchApply).toHaveBeenCalledTimes(2)
    })

    it('returns null immediately when signal is already aborted', async () => {
        const controller = new AbortController()
        controller.abort()
        const fetchApply = jest.fn()

        const result = await pollUntilApplyAdvances({
            fetchApply,
            intervalMs: 0,
            timeoutMs: 10_000,
            signal: controller.signal,
            sleep: noSleep,
        })

        expect(result).toBeNull()
        expect(fetchApply).not.toHaveBeenCalled()
    })
})

describe('pollUntilReady', () => {
    const noSleep = async () => {}

    it('returns true once the backend reports ready', async () => {
        const fetchReadiness = jest.fn().mockResolvedValueOnce({ ready: false }).mockResolvedValueOnce({ ready: true })

        const result = await pollUntilReady({ fetchReadiness, intervalMs: 0, timeoutMs: 10_000, sleep: noSleep })

        expect(result).toBe(true)
        expect(fetchReadiness).toHaveBeenCalledTimes(2)
    })

    it('returns false on a clean timeout (backend healthy, never went ready)', async () => {
        const fetchReadiness = jest.fn().mockResolvedValue({ ready: false })
        let clock = 0

        const result = await pollUntilReady({
            fetchReadiness,
            intervalMs: 1000,
            timeoutMs: 3000,
            sleep: async (ms) => {
                clock += ms
            },
            now: () => clock,
        })

        expect(result).toBe(false)
    })

    // The fix: a PERSISTENT failure (auth / 5xx) must surface its real reason on
    // timeout instead of being collapsed into a misleading `false` ("taking longer").
    it('throws the last error when the most recent poll keeps failing', async () => {
        const fetchReadiness = jest.fn().mockRejectedValue(new Error('401 session expired'))
        let clock = 0

        await expect(
            pollUntilReady({
                fetchReadiness,
                intervalMs: 1000,
                timeoutMs: 3000,
                sleep: async (ms) => {
                    clock += ms
                },
                now: () => clock,
            })
        ).rejects.toThrow('401 session expired')
    })

    // A transient blip that recovers must NOT surface a stale error: if the latest
    // poll was a clean (not-ready) response, timeout returns false, not the old error.
    it('does not throw a stale error after recovery — returns false on clean timeout', async () => {
        const fetchReadiness = jest
            .fn()
            .mockRejectedValueOnce(new Error('transient 503'))
            .mockResolvedValue({ ready: false })
        let clock = 0

        const result = await pollUntilReady({
            fetchReadiness,
            intervalMs: 1000,
            timeoutMs: 3000,
            sleep: async (ms) => {
                clock += ms
            },
            now: () => clock,
        })

        expect(result).toBe(false)
    })

    it('returns null when the signal is already aborted', async () => {
        const controller = new AbortController()
        controller.abort()
        const fetchReadiness = jest.fn()

        const result = await pollUntilReady({
            fetchReadiness,
            intervalMs: 0,
            timeoutMs: 10_000,
            signal: controller.signal,
            sleep: noSleep,
        })

        expect(result).toBeNull()
        expect(fetchReadiness).not.toHaveBeenCalled()
    })
})
