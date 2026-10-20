/**
 * How a closed Bridge ToS page is settled. Bridge's page reports a signature by
 * postMessage only when its link has no redirect; otherwise it moves its own
 * frame away and reports nothing (TASK-23881). And the android flow runs in the
 * system browser, where nothing in-app observes the signature at all. So for
 * every close except an observed `tos_accepted`, Bridge's answer is the only
 * source of truth.
 */
import posthog from 'posthog-js'
import { resolveBridgeTosClose } from '@/hooks/useMultiPhaseKycFlow'
import { markSubmitted } from '@/hooks/useSubmissionWindow'
import { type IframeCloseSource } from '@/components/Global/IframeWrapper'

const mockConfirmBridgeTos = jest.fn()
jest.mock('@/app/actions/users', () => ({
    getBridgeTosLink: jest.fn(),
    confirmBridgeTos: () => mockConfirmBridgeTos(),
}))
jest.mock('@/hooks/useSubmissionWindow', () => ({ markSubmitted: jest.fn(), useSubmissionWindow: jest.fn() }))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))

const fetchUser = jest.fn().mockResolvedValue(null)

describe('resolveBridgeTosClose', () => {
    beforeEach(() => {
        jest.useFakeTimers()
        mockConfirmBridgeTos.mockReset()
        fetchUser.mockClear()
        ;(markSubmitted as jest.Mock).mockClear()
        ;(posthog.capture as jest.Mock).mockClear()
    })
    afterEach(() => jest.useRealTimers())

    // Drives the helper to completion while its sleeps are faked away.
    const run = async (source: IframeCloseSource) => {
        const pending = resolveBridgeTosClose(fetchUser, source)
        await jest.runAllTimersAsync()
        return pending
    }

    it("reports Bridge's yes and records the acceptance with how the page closed", async () => {
        mockConfirmBridgeTos.mockResolvedValue({ data: { accepted: true } })
        await expect(run('returned')).resolves.toBe(true)
        expect(mockConfirmBridgeTos).toHaveBeenCalledTimes(1)
        expect(posthog.capture).toHaveBeenCalledWith('kyc_tos_accepted', { source: 'returned' })
        expect(markSubmitted).toHaveBeenCalled()
        expect(fetchUser).toHaveBeenCalled()
    })

    it('retries once and reports the retry verdict, not the first miss', async () => {
        mockConfirmBridgeTos
            .mockResolvedValueOnce({ data: { accepted: false } })
            .mockResolvedValueOnce({ data: { accepted: true } })
        await expect(run('returned')).resolves.toBe(true)
        expect(mockConfirmBridgeTos).toHaveBeenCalledTimes(2)
    })

    it('stops after the retry when nothing observed an acceptance and Bridge says no', async () => {
        // no submission happened, so no grace window to arm and no rail change
        // to poll for — fail fast instead.
        mockConfirmBridgeTos.mockResolvedValue({ data: { accepted: false } })
        await expect(run('returned')).resolves.toBe(false)
        expect(mockConfirmBridgeTos).toHaveBeenCalledTimes(2)
        expect(markSubmitted).not.toHaveBeenCalled()
        expect(fetchUser).not.toHaveBeenCalled()
        expect(posthog.capture).not.toHaveBeenCalled()
    })

    it('reports no when the confirm call errored out', async () => {
        mockConfirmBridgeTos.mockResolvedValue({ error: 'Failed to confirm Bridge ToS' })
        await expect(run('returned')).resolves.toBe(false)
    })

    it("treats Bridge's own signature report as accepted even if the confirm endpoint lags", async () => {
        mockConfirmBridgeTos.mockResolvedValue({ data: { accepted: false } })
        await expect(run('tos_accepted')).resolves.toBe(true)
        expect(markSubmitted).toHaveBeenCalled()
        expect(fetchUser).toHaveBeenCalled()
        expect(posthog.capture).toHaveBeenCalledWith('kyc_tos_accepted', { source: 'tos_accepted' })
    })

    it('recovers a user who backed out of a page that never reported their signature', async () => {
        mockConfirmBridgeTos.mockResolvedValue({ data: { accepted: true } })
        await expect(run('manual')).resolves.toBe(true)
        expect(posthog.capture).toHaveBeenCalledWith('kyc_tos_accepted', { source: 'manual' })
        expect(fetchUser).toHaveBeenCalled()
    })

    it('asks only once when the user backed out of an unsigned page', async () => {
        mockConfirmBridgeTos.mockResolvedValue({ data: { accepted: false } })
        await expect(run('manual')).resolves.toBe(false)
        expect(mockConfirmBridgeTos).toHaveBeenCalledTimes(1)
        expect(markSubmitted).not.toHaveBeenCalled()
    })
})
