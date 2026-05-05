import { pollUntilApplyAdvances } from '@/components/Card/cardApply.utils'

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
})
