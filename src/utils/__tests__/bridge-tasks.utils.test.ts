import {
    ADVISORY_FINAL_WEEK_DAYS,
    ADVISORY_HEADS_UP_WINDOW_DAYS,
    bridgeTaskDismissalKey,
    hasNativeBridgeStep,
    headsUpDeadline,
    isInFinalWeek,
    selectBridgeTasks,
    selectHomeTasks,
} from '../bridge-tasks.utils'
import type { NextAction, RailCapability } from '@/types/capabilities'

const action = (overrides: Partial<NextAction>): NextAction => ({
    key: 'accept-tos',
    kind: 'accept-tos',
    purpose: 'accept-bridge-tos',
    ...overrides,
})

const rail = (overrides: Partial<RailCapability>): RailCapability => ({
    id: 'bridge.sepa_eu',
    provider: 'bridge',
    method: 'SEPA_EU',
    channel: 'bank',
    country: 'EU',
    currency: 'EUR',
    status: 'requires-info',
    ...overrides,
})

const hosted = action({ key: 'bridge-hosted', kind: 'bridge-hosted', purpose: 'bridge-additional-verification' })
const poaUpload = action({ key: 'sumsub:proof_of_address', kind: 'sumsub', purpose: 'unlock-bridge' })

describe('selectBridgeTasks', () => {
    it('keeps accept-tos and bridge-hosted, drops everything else', () => {
        const tasks = selectBridgeTasks([
            action({ key: 'accept-tos', kind: 'accept-tos' }),
            action({ key: 'bridge-hosted', kind: 'bridge-hosted', purpose: 'bridge-additional-verification' }),
            action({ key: 'sumsub:proof_of_address', kind: 'sumsub' }),
            action({ key: 'wait:bridge', kind: 'wait' }),
            action({ key: 'contact-support', kind: 'contact-support' }),
        ])
        expect(tasks.map((t) => t.key)).toEqual(['accept-tos', 'bridge-hosted'])
    })

    it('returns [] when nothing is pending', () => {
        expect(selectBridgeTasks([])).toEqual([])
        expect(selectBridgeTasks([action({ key: 'sumsub:eea_uplift', kind: 'sumsub' })])).toEqual([])
    })

    it('a BLOCKING hosted task stands down while a requires-info Bridge rail carries a native sumsub step (TASK-22818)', () => {
        // Bridge lists `kyc_approval` / its proof-of-address tier marker beside
        // the document it wants; the hosted flow cannot collect the document.
        const rails = [rail({ blockingActions: ['sumsub:proof_of_address'] })]
        expect(selectBridgeTasks([action({}), hosted, poaUpload], rails).map((t) => t.key)).toEqual(['accept-tos'])
    })

    it('the stand-down needs a Bridge rail in requires-info with a sumsub step — nothing else triggers it', () => {
        // enabled rail (advisory arm), a wait marker, a Manteca rail: hosted stays
        expect(selectBridgeTasks([hosted, poaUpload], [rail({ status: 'enabled', blockingActions: [] })])).toEqual([
            hosted,
        ])
        expect(
            selectBridgeTasks(
                [hosted, action({ key: 'wait:bridge', kind: 'wait' })],
                [rail({ blockingActions: ['wait:bridge'] })]
            )
        ).toEqual([hosted])
        expect(
            selectBridgeTasks(
                [hosted, poaUpload],
                [rail({ id: 'manteca.pix_br', provider: 'manteca', blockingActions: ['sumsub:proof_of_address'] })]
            )
        ).toEqual([hosted])
    })

    it('hasNativeBridgeStep is the predicate the prep screen branches on', () => {
        expect(hasNativeBridgeStep([poaUpload], [rail({ blockingActions: ['sumsub:proof_of_address'] })])).toBe(true)
        expect(hasNativeBridgeStep([poaUpload], [])).toBe(false)
    })

    it('an ADVISORY hosted task (future-dated, rail still working) stays beside a native step', () => {
        const advisory = { ...hosted, effectiveDate: '2099-09-01' }
        const rails = [rail({ blockingActions: ['sumsub:proof_of_address'] })]
        expect(selectBridgeTasks([advisory, poaUpload], rails)).toEqual([advisory])
    })

    it('keeps a sumsub document request due inside the heads-up window, never a blocking one', () => {
        const now = new Date('2026-09-25T12:00:00Z')
        const eeaUplift = action({
            key: 'sumsub:eea_uplift',
            kind: 'sumsub',
            effectiveDate: '2026-10-01',
            requirementKey: 'place_of_birth_missing',
        })
        const expiringId = action({
            key: 'sumsub:government_id',
            kind: 'sumsub',
            effectiveDate: '2027-07-31',
            requirementKey: 'government_id_expired',
        })
        expect(selectBridgeTasks([eeaUplift, expiringId, poaUpload], [], now)).toEqual([eeaUplift])
    })

    it('passes advisory metadata (effectiveDate) through untouched', () => {
        const [task] = selectBridgeTasks([
            action({ key: 'bridge-hosted', kind: 'bridge-hosted', effectiveDate: '2099-09-01' }),
        ])
        expect(task.effectiveDate).toBe('2099-09-01')
    })
})

describe('headsUpDeadline', () => {
    const now = new Date('2026-09-25T12:00:00Z')

    it('the EEA uplift due 2026-10-01 is inside the window; an ID expiring in 2027 is outside', () => {
        expect(headsUpDeadline('2026-10-01', now)).toBe('2026-10-01')
        expect(headsUpDeadline('2027-07-31', now)).toBeUndefined()
    })

    it(`the edge is exactly ${ADVISORY_HEADS_UP_WINDOW_DAYS} days`, () => {
        const day = 24 * 60 * 60 * 1000
        const edge = new Date(now.getTime() + ADVISORY_HEADS_UP_WINDOW_DAYS * day)
        const pastEdge = new Date(edge.getTime() + day)
        expect(headsUpDeadline(edge.toISOString(), now)).toBe(edge.toISOString())
        expect(headsUpDeadline(pastEdge.toISOString(), now)).toBeUndefined()
    })

    it('a past date is still due, so it stays inside; no date or a bad date is outside', () => {
        expect(headsUpDeadline('2026-06-29', now)).toBe('2026-06-29')
        expect(headsUpDeadline(undefined, now)).toBeUndefined()
        expect(headsUpDeadline('not-a-date', now)).toBeUndefined()
    })
})

describe('selectHomeTasks — one CTA surface on Home', () => {
    const now = new Date('2026-09-25T12:00:00Z')
    const due = (days: number) => new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString()
    const documentRequest = (days: number) =>
        action({ key: 'sumsub:eea_uplift', kind: 'sumsub', effectiveDate: due(days), requirementKey: 'nationalities' })

    it(`more than ${ADVISORY_HEADS_UP_WINDOW_DAYS} days out: nothing on Home`, () => {
        expect(selectHomeTasks([documentRequest(40)], [], now)).toEqual({ largeTasks: [], documentSlide: undefined })
    })

    it(`${ADVISORY_HEADS_UP_WINDOW_DAYS} to ${ADVISORY_FINAL_WEEK_DAYS + 1} days out: one small carousel slide, no large card`, () => {
        const request = documentRequest(20)
        expect(selectHomeTasks([request], [], now)).toEqual({ largeTasks: [], documentSlide: request })
        expect(selectHomeTasks([documentRequest(8)], [], now).largeTasks).toEqual([])
    })

    it(`last ${ADVISORY_FINAL_WEEK_DAYS} days, or past due: the large card, no slide`, () => {
        for (const days of [7, 3, -2]) {
            const request = documentRequest(days)
            expect(selectHomeTasks([request], [], now)).toEqual({ largeTasks: [request], documentSlide: undefined })
        }
    })

    it('ToS and hosted tasks stay large cards whatever their date', () => {
        const tos = action({ key: 'accept-tos:sepa', effectiveDate: due(60) })
        expect(selectHomeTasks([tos, documentRequest(20)], [], now).largeTasks).toEqual([tos])
    })

    it('isInFinalWeek: the edge is exactly the final-week constant', () => {
        expect(isInFinalWeek(due(ADVISORY_FINAL_WEEK_DAYS), now)).toBe(true)
        expect(isInFinalWeek(due(ADVISORY_FINAL_WEEK_DAYS + 1), now)).toBe(false)
        expect(isInFinalWeek(undefined, now)).toBe(false)
    })
})

describe('bridgeTaskDismissalKey', () => {
    it('advisory → blocking (effectiveDate disappears) changes the fingerprint', () => {
        const advisory = action({ key: 'accept-tos:sepa', effectiveDate: '2099-09-01' })
        const blocking = action({ key: 'accept-tos:sepa' })
        expect(bridgeTaskDismissalKey(advisory)).not.toBe(bridgeTaskDismissalKey(blocking))
    })

    it('a new requirement under the shared bridge-hosted key changes the fingerprint', () => {
        const first = action({ key: 'bridge-hosted', kind: 'bridge-hosted', requirementKey: 'kyc_approval' })
        const second = action({
            key: 'bridge-hosted',
            kind: 'bridge-hosted',
            requirementKey: 'kyc_with_proof_of_address',
        })
        expect(bridgeTaskDismissalKey(first)).not.toBe(bridgeTaskDismissalKey(second))
    })

    it('an unchanged task keeps a stable fingerprint', () => {
        const task = action({
            key: 'accept-tos:sepa',
            effectiveDate: '2099-09-01',
            requirementKey: 'tos_v2_acceptance',
        })
        expect(bridgeTaskDismissalKey(task)).toBe(bridgeTaskDismissalKey({ ...task }))
    })
})
