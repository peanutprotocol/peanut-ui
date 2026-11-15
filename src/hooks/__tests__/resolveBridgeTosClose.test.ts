/**
 * How a closed Bridge ToS page is settled. Bridge's page reports a signature by
 * postMessage only when its link has no redirect; otherwise it moves its own
 * frame away and reports nothing (TASK-23881). And the android flow runs in the
 * system browser, where nothing in-app observes the signature at all. So for
 * a page that closed by itself, Bridge's answer is the only source of truth.
 */
import posthog from 'posthog-js'
import { resolveBridgeTosClose } from '@/hooks/useMultiPhaseKycFlow'
import { markSubmitted } from '@/hooks/useSubmissionWindow'
import { type IframeCloseSource } from '@/components/Global/IframeWrapper'
import type { FeatureReport, FeatureReportEntry, NextAction, UserCapabilities } from '@/types/capabilities'

const mockConfirmBridgeTos = jest.fn()
jest.mock('@/app/actions/users', () => ({
    getBridgeTosLink: jest.fn(),
    confirmBridgeTos: () => mockConfirmBridgeTos(),
}))
jest.mock('@/hooks/useSubmissionWindow', () => ({ markSubmitted: jest.fn(), useSubmissionWindow: jest.fn() }))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))

const terms: NextAction = { key: 'bridge-tos', kind: 'accept-tos', purpose: 'unlock-bridge' }
const requiresTerms: FeatureReportEntry = { state: 'action_required', action: terms.key }
const settledFeatures: FeatureReport = {
    qr: { state: 'on' },
    card: { state: 'ready' },
    local: { state: 'pending', accounts: {} },
    bank: { ...requiresTerms, accounts: { USD: { state: 'setting_up' }, EUR: requiresTerms } },
}
const settled: UserCapabilities = { rails: [], restrictions: [], nextActions: [terms], features: settledFeatures }
const pending: UserCapabilities = {
    ...settled,
    features: { ...settledFeatures, bank: { ...requiresTerms, accounts: { USD: requiresTerms, EUR: requiresTerms } } },
}
const fetchUser = jest.fn()

describe('resolveBridgeTosClose', () => {
    beforeEach(() => {
        jest.useFakeTimers()
        mockConfirmBridgeTos.mockReset()
        fetchUser.mockReset().mockResolvedValue({ capabilities: settled })
        ;(markSubmitted as jest.Mock).mockClear()
        ;(posthog.capture as jest.Mock).mockClear()
    })
    afterEach(() => jest.useRealTimers())

    // Drives the helper to completion while its sleeps are faked away.
    const run = async (source: Exclude<IframeCloseSource, 'manual'>) => {
        const verdict = resolveBridgeTosClose(fetchUser, source, 'US')
        await jest.runAllTimersAsync()
        return verdict
    }

    it("reports Bridge's yes and records the acceptance with how the page closed", async () => {
        mockConfirmBridgeTos.mockResolvedValue({ data: { accepted: true } })
        await expect(run('returned')).resolves.toBe('accepted')
        expect(mockConfirmBridgeTos).toHaveBeenCalledTimes(1)
        expect(posthog.capture).toHaveBeenCalledWith('kyc_tos_accepted', { source: 'returned' })
        expect(markSubmitted).toHaveBeenCalled()
        expect(fetchUser).toHaveBeenCalled()
    })

    it('retries once and reports the retry verdict, not the first miss', async () => {
        mockConfirmBridgeTos
            .mockResolvedValueOnce({ data: { accepted: false } })
            .mockResolvedValueOnce({ data: { accepted: true } })
        await expect(run('returned')).resolves.toBe('accepted')
        expect(mockConfirmBridgeTos).toHaveBeenCalledTimes(2)
    })

    it('stops after the retry when nothing observed an acceptance and Bridge says no', async () => {
        // no submission happened, so no grace window to arm and no rail change
        // to poll for — fail fast instead.
        mockConfirmBridgeTos.mockResolvedValue({ data: { accepted: false } })
        await expect(run('returned')).resolves.toBe('not-accepted')
        expect(mockConfirmBridgeTos).toHaveBeenCalledTimes(2)
        expect(markSubmitted).not.toHaveBeenCalled()
        expect(fetchUser).not.toHaveBeenCalled()
        expect(posthog.capture).not.toHaveBeenCalled()
    })

    // TASK-24909: a failed request is not a "no"; the step says it could not check
    it('reports a failure, not a no, when the confirm call errored out', async () => {
        mockConfirmBridgeTos.mockResolvedValue({ error: 'Failed to confirm Bridge ToS' })
        await expect(run('returned')).resolves.toBe('failed')
        expect(mockConfirmBridgeTos).toHaveBeenCalledTimes(2)
        expect(fetchUser).not.toHaveBeenCalled()
    })

    it("takes the retry's answer when only the first confirm call failed", async () => {
        mockConfirmBridgeTos
            .mockResolvedValueOnce({ error: 'Failed to confirm Bridge ToS' })
            .mockResolvedValueOnce({ data: { accepted: false } })
        await expect(run('returned')).resolves.toBe('not-accepted')
    })

    it('does not advance on an early signature when confirmation is negative', async () => {
        mockConfirmBridgeTos.mockResolvedValue({ data: { accepted: false } })
        await expect(run('tos_accepted')).resolves.toBe('not-accepted')
        expect(mockConfirmBridgeTos).toHaveBeenCalledTimes(2)
        expect(markSubmitted).not.toHaveBeenCalled()
        expect(fetchUser).not.toHaveBeenCalled()
    })

    it('waits for USD terms after a signature, even when EUR still needs terms', async () => {
        mockConfirmBridgeTos.mockResolvedValue({ data: { accepted: true } })
        fetchUser.mockResolvedValueOnce({ capabilities: pending }).mockResolvedValueOnce({ capabilities: settled })
        await expect(run('tos_accepted')).resolves.toBe('accepted')
        expect(markSubmitted).toHaveBeenCalled()
        expect(fetchUser).toHaveBeenCalledTimes(2)
        expect(posthog.capture).toHaveBeenCalledWith('kyc_tos_accepted', { source: 'tos_accepted' })
    })

    // TASK-24909: Bridge has the signature, the account still asks for terms. Another page
    // cannot change that, so the step must not read it as "not accepted, try again".
    it.each([
        ['missing', null],
        ['blocked on USD terms', { capabilities: pending }],
    ])('reports an acceptance not yet reflected when the confirmed profile remains %s', async (_label, profile) => {
        mockConfirmBridgeTos.mockResolvedValue({ data: { accepted: true } })
        fetchUser.mockResolvedValue(profile)
        await expect(run('returned')).resolves.toBe('unconfirmed')
        expect(fetchUser).toHaveBeenCalledTimes(3)
        expect(markSubmitted).toHaveBeenCalled()
    })
})
