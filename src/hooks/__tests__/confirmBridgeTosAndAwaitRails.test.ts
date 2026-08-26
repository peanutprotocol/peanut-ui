/**
 * The android ToS flow runs in the system browser (Capacitor's WebView cancels
 * third-party subframe navigations), so nothing in-app observes the signature —
 * the caller's only source of truth is this helper's return value.
 */
import { confirmBridgeTosAndAwaitRails } from '@/hooks/useMultiPhaseKycFlow'
import { markSubmitted } from '@/hooks/useSubmissionWindow'

const mockConfirmBridgeTos = jest.fn()
jest.mock('@/app/actions/users', () => ({
    getBridgeTosLink: jest.fn(),
    confirmBridgeTos: () => mockConfirmBridgeTos(),
}))
jest.mock('@/hooks/useSubmissionWindow', () => ({ markSubmitted: jest.fn(), useSubmissionWindow: jest.fn() }))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))

const fetchUser = jest.fn().mockResolvedValue(null)

describe('confirmBridgeTosAndAwaitRails', () => {
    beforeEach(() => {
        jest.useFakeTimers()
        mockConfirmBridgeTos.mockReset()
        fetchUser.mockClear()
        ;(markSubmitted as jest.Mock).mockClear()
    })
    afterEach(() => jest.useRealTimers())

    // Drives the helper to completion while its sleeps are faked away.
    const run = async (options?: { observedAcceptance?: boolean }) => {
        const pending = confirmBridgeTosAndAwaitRails(fetchUser, options)
        await jest.runAllTimersAsync()
        return pending
    }

    it("reports Bridge's yes", async () => {
        mockConfirmBridgeTos.mockResolvedValue({ data: { accepted: true } })
        await expect(run()).resolves.toBe(true)
        expect(mockConfirmBridgeTos).toHaveBeenCalledTimes(1)
    })

    it('retries once and reports the retry verdict, not the first miss', async () => {
        mockConfirmBridgeTos
            .mockResolvedValueOnce({ data: { accepted: false } })
            .mockResolvedValueOnce({ data: { accepted: true } })
        await expect(run()).resolves.toBe(true)
        expect(mockConfirmBridgeTos).toHaveBeenCalledTimes(2)
    })

    it("reports Bridge's no after the retry", async () => {
        mockConfirmBridgeTos.mockResolvedValue({ data: { accepted: false } })
        await expect(run()).resolves.toBe(false)
        expect(mockConfirmBridgeTos).toHaveBeenCalledTimes(2)
    })

    it('reports no when the confirm call errored out', async () => {
        mockConfirmBridgeTos.mockResolvedValue({ error: 'Failed to confirm Bridge ToS' })
        await expect(run()).resolves.toBe(false)
    })

    it('still arms the submission window and polls on a lagging confirm when the acceptance was observed', async () => {
        // web iframe race: Bridge's postMessage said "signed", the confirm
        // endpoint hasn't caught up — the historical behavior must survive.
        mockConfirmBridgeTos.mockResolvedValue({ data: { accepted: false } })
        await expect(run({ observedAcceptance: true })).resolves.toBe(false)
        expect(markSubmitted).toHaveBeenCalled()
        expect(fetchUser).toHaveBeenCalled()
    })

    it('stops after the retry when nothing observed an acceptance and Bridge says no', async () => {
        // android `returned` abandonment: no submission happened, so no grace
        // window to arm and no rail change to poll for — fail fast instead.
        mockConfirmBridgeTos.mockResolvedValue({ data: { accepted: false } })
        await expect(run({ observedAcceptance: false })).resolves.toBe(false)
        expect(mockConfirmBridgeTos).toHaveBeenCalledTimes(2)
        expect(markSubmitted).not.toHaveBeenCalled()
        expect(fetchUser).not.toHaveBeenCalled()
    })

    it('proceeds normally when nothing observed an acceptance but Bridge says yes', async () => {
        mockConfirmBridgeTos.mockResolvedValue({ data: { accepted: true } })
        await expect(run({ observedAcceptance: false })).resolves.toBe(true)
        expect(markSubmitted).toHaveBeenCalled()
        expect(fetchUser).toHaveBeenCalled()
    })
})
