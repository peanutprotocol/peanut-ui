import { pollUntilApplyAdvances, resolvePostSumsubAction } from '@/components/Card/cardApply.utils'

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

describe('resolvePostSumsubAction', () => {
    // The bug this resolver fixes: a user finishes the MAIN-level WebSDK
    // (e.g. Rain-required SELFIE), the BE's next /rain/cards call returns
    // `incomplete` + new token at `rain-card-application`. The old code
    // polled "until status != incomplete" and timed out, showing "taking
    // longer than expected" instead of reopening the WebSDK at the new
    // level. This test pins the level-transition fix.
    it('reopens the WebSDK at rain-card-application when MAIN just completed', async () => {
        const fetchApply = jest.fn().mockResolvedValueOnce({
            status: 'incomplete',
            missing: ['questionnaire'],
            questionnaireComplete: false,
            sumsubAccessToken: 'next-level-token',
        })

        const result = await resolvePostSumsubAction({
            justCompletedLevel: 'main',
            fetchApply,
            intervalMs: 1000,
            timeoutMs: 15000,
            sleep: noSleep,
        })

        expect(result).toEqual({
            kind: 'reopen-websdk',
            sumsubAccessToken: 'next-level-token',
            level: 'rain-card-application',
        })
        // MAIN branch is a single fetch, not a poll — calling fetchApply
        // more than once would mean we lost the discriminator and slipped
        // back into the timeout-prone loop.
        expect(fetchApply).toHaveBeenCalledTimes(1)
    })

    it('advances when MAIN just completed but BE skipped straight to terms-required', async () => {
        // Edge case: a returning user already has the action questionnaire
        // filled (questionnaireProcessingSettings.skipIfFilled=true). After
        // they re-submit the MAIN selfie, the BE skips the action level and
        // returns terms-required directly. The resolver must advance, not
        // try to reopen a WebSDK with no token.
        const fetchApply = jest.fn().mockResolvedValueOnce({
            status: 'terms-required',
            isUsResident: false,
            termsVersion: '2026-04-21',
        })

        const result = await resolvePostSumsubAction({
            justCompletedLevel: 'main',
            fetchApply,
            intervalMs: 1000,
            timeoutMs: 15000,
            sleep: noSleep,
        })

        expect(result).toEqual({
            kind: 'advance',
            response: { status: 'terms-required', isUsResident: false, termsVersion: '2026-04-21' },
        })
        expect(fetchApply).toHaveBeenCalledTimes(1)
    })

    it('polls until the response advances when rain-card-application just completed', async () => {
        // Action-level path: Sumsub auto-review for the questionnaire takes
        // a beat, so `incomplete` here genuinely means "wait" — not a level
        // transition. Same poll loop the old code used.
        const fetchApply = jest
            .fn()
            .mockResolvedValueOnce({ status: 'incomplete', sumsubAccessToken: 't1' })
            .mockResolvedValueOnce({ status: 'terms-required', isUsResident: false, termsVersion: 'v' })

        const result = await resolvePostSumsubAction({
            justCompletedLevel: 'rain-card-application',
            fetchApply,
            intervalMs: 0,
            timeoutMs: 10_000,
            sleep: noSleep,
        })

        expect(result).toEqual({
            kind: 'advance',
            response: { status: 'terms-required', isUsResident: false, termsVersion: 'v' },
        })
        expect(fetchApply).toHaveBeenCalledTimes(2)
    })

    it('returns timeout when the rain-card-application poll runs out the clock', async () => {
        const fetchApply = jest.fn().mockResolvedValue({ status: 'incomplete', sumsubAccessToken: 't' })
        let clock = 0
        const tick = (ms: number) => {
            clock += ms
        }

        const result = await resolvePostSumsubAction({
            justCompletedLevel: 'rain-card-application',
            fetchApply,
            intervalMs: 1000,
            timeoutMs: 3000,
            sleep: async (ms) => tick(ms),
            now: () => clock,
        })

        expect(result).toEqual({ kind: 'timeout' })
    })

    it('returns aborted when the signal is already aborted on entry (MAIN path)', async () => {
        const controller = new AbortController()
        controller.abort()
        const fetchApply = jest.fn()

        const result = await resolvePostSumsubAction({
            justCompletedLevel: 'main',
            fetchApply,
            intervalMs: 0,
            timeoutMs: 10_000,
            signal: controller.signal,
            sleep: noSleep,
        })

        expect(result).toEqual({ kind: 'aborted' })
        expect(fetchApply).not.toHaveBeenCalled()
    })

    it('returns aborted when the signal fires mid-poll (rain-card-application path)', async () => {
        const controller = new AbortController()
        const fetchApply = jest.fn().mockImplementation(async () => {
            if (fetchApply.mock.calls.length === 2) controller.abort()
            return { status: 'incomplete', sumsubAccessToken: 't' }
        })

        const result = await resolvePostSumsubAction({
            justCompletedLevel: 'rain-card-application',
            fetchApply,
            intervalMs: 0,
            timeoutMs: 10_000,
            signal: controller.signal,
            sleep: noSleep,
        })

        expect(result).toEqual({ kind: 'aborted' })
    })

    it('treats a null justCompletedLevel like rain-card-application (poll, no MAIN fast-path)', async () => {
        // The component clears the ref to null only in initial mount state.
        // If Sumsub fires onComplete before the ref is stamped (shouldn't
        // happen, but defending the boundary), fall back to the poll path
        // so we don't false-positive a reopen on a regular incomplete.
        const fetchApply = jest.fn().mockResolvedValueOnce({ status: 'pending', rainUserId: 'u', message: 'ok' })

        const result = await resolvePostSumsubAction({
            justCompletedLevel: null,
            fetchApply,
            intervalMs: 0,
            timeoutMs: 10_000,
            sleep: noSleep,
        })

        expect(result).toEqual({ kind: 'advance', response: { status: 'pending', rainUserId: 'u', message: 'ok' } })
    })

    it('propagates errors from fetchApply on the MAIN path', async () => {
        const fetchApply = jest.fn().mockRejectedValue(new Error('network down'))

        await expect(
            resolvePostSumsubAction({
                justCompletedLevel: 'main',
                fetchApply,
                intervalMs: 0,
                timeoutMs: 10_000,
                sleep: noSleep,
            })
        ).rejects.toThrow('network down')
    })
})
