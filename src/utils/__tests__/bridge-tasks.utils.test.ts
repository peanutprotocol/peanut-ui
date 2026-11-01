import {
    ADVISORY_FINAL_WEEK_DAYS,
    ADVISORY_HEADS_UP_WINDOW_DAYS,
    bridgeTaskDismissalKey,
    hasNativeBridgeStep,
    headsUpDeadline,
    isCardDocumentTask,
    isInFinalWeek,
    selectBridgeTasks,
    selectCardDocumentTask,
    selectHomeTasks,
} from '../bridge-tasks.utils'
import type { FeatureReport, FeatureReportEntry, NextAction } from '@/types/capabilities'
import { featureReport } from '@/test-utils/featureReport.fixture'

const action = (overrides: Partial<NextAction> = {}): NextAction => ({
    key: 'accept-tos',
    kind: 'accept-tos',
    purpose: 'accept-bridge-tos',
    ...overrides,
})
const hosted = action({ key: 'bridge-hosted', kind: 'bridge-hosted', purpose: 'bridge-additional-verification' })
const poaUpload = action({ key: 'sumsub:proof_of_address', kind: 'sumsub', purpose: 'unlock-bridge' })
const emptyReport = (): FeatureReport =>
    featureReport({ rails: [], nextActions: [], identity: { status: 'verified' }, residence: null })
// Each supplied entry explicitly names a task; nextActions alone never makes one.
const bankReport = (...entries: FeatureReportEntry[]): FeatureReport => ({
    ...emptyReport(),
    bank: { state: 'ready', accounts: Object.fromEntries(entries.map((entry, i) => [String(i), entry])) },
})
const step = (task: NextAction): FeatureReportEntry => ({
    state: task.effectiveDate ? 'on' : 'action_required',
    action: task.key,
})
const naming = (...tasks: NextAction[]) => bankReport(...tasks.map(step))

describe('selectBridgeTasks', () => {
    it('keeps named accept-tos and bridge-hosted, drops everything else', () => {
        const tos = action()
        const wait = action({ key: 'wait', kind: 'wait' })
        const support = action({ key: 'support', kind: 'contact-support' })
        const tasks = [tos, hosted, poaUpload, wait, support]
        const report = bankReport(
            step(tos),
            step(hosted),
            { state: 'setting_up', action: wait.key },
            { state: 'refused', action: support.key }
        )
        expect(selectBridgeTasks(tasks, report)).toEqual([tos, hosted])
    })
    it('returns [] when nothing is pending or the report names no task', () => {
        expect(selectBridgeTasks([], emptyReport())).toEqual([])
        expect(selectBridgeTasks([poaUpload], emptyReport())).toEqual([])
        expect(selectBridgeTasks([hosted], undefined)).toEqual([])
    })
    it('a BLOCKING hosted task stands down while the bank report names a native Sumsub step (TASK-22818)', () => {
        const tos = action()
        expect(selectBridgeTasks([tos, hosted, poaUpload], naming(tos, hosted, poaUpload))).toEqual([tos])
    })
    it('the stand-down needs an action_required bank entry — other states and features do not trigger it', () => {
        const wait = action({ key: 'wait', kind: 'wait' })
        const on = bankReport(step(hosted), { state: 'on', action: poaUpload.key })
        expect(selectBridgeTasks([hosted, poaUpload], on)).toEqual([hosted])
        expect(
            selectBridgeTasks([hosted, wait], bankReport(step(hosted), { state: 'setting_up', action: wait.key }))
        ).toEqual([hosted])
        const local = naming(hosted)
        local.local = { state: 'action_required', action: poaUpload.key, accounts: {} }
        expect(selectBridgeTasks([hosted, poaUpload], local)).toEqual([hosted])
    })
    it('hasNativeBridgeStep is the predicate the prep screen branches on', () => {
        expect(hasNativeBridgeStep([poaUpload], naming(poaUpload))).toBe(true)
        expect(hasNativeBridgeStep([poaUpload], emptyReport())).toBe(false)
    })
    it('an ADVISORY hosted task stays beside a native step', () => {
        const advisory = { ...hosted, effectiveDate: '2099-09-01' }
        expect(selectBridgeTasks([advisory, poaUpload], naming(advisory, poaUpload))).toEqual([advisory])
    })
    it('keeps a named Sumsub document request due inside the heads-up window, never a blocking one', () => {
        const now = new Date('2026-09-25T12:00:00Z')
        const eea = action({
            key: 'eea',
            kind: 'sumsub',
            effectiveDate: '2026-10-01',
            requirementKey: 'place_of_birth_missing',
        })
        const id = action({
            key: 'id',
            kind: 'sumsub',
            effectiveDate: '2027-07-31',
            requirementKey: 'government_id_expired',
        })
        expect(selectBridgeTasks([eea, id, poaUpload], naming(eea, id, poaUpload), now)).toEqual([eea])
    })
    it('passes advisory metadata (effectiveDate) through untouched', () => {
        const advisory = { ...hosted, effectiveDate: '2099-09-01' }
        expect(selectBridgeTasks([advisory], naming(advisory))[0]).toEqual(advisory)
    })
    it.each(['ready', 'setting_up', 'pending', 'refused'] as const)(
        'does not list an action from a %s entry',
        (state) => {
            const report = bankReport({ state, action: hosted.key })
            expect(selectBridgeTasks([hosted], report)).toEqual([])
        }
    )
    it('deduplicates a named action across aggregate and account entries and ignores unknown keys', () => {
        const report = naming(hosted, hosted)
        report.bank.action = hosted.key
        report.bank.state = 'action_required'
        report.bank.accounts.unknown = { state: 'action_required', action: 'unknown' }
        expect(selectBridgeTasks([hosted], report)).toEqual([hosted])
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
    const due = (days: number) => new Date(now.getTime() + days * 86400000).toISOString()
    const documentRequest = (days: number) =>
        action({ key: 'sumsub:eea_uplift', kind: 'sumsub', effectiveDate: due(days), requirementKey: 'nationalities' })
    it(`more than ${ADVISORY_HEADS_UP_WINDOW_DAYS} days out: nothing on Home`, () => {
        const request = documentRequest(40)
        expect(selectHomeTasks([request], naming(request), now)).toEqual({ largeTasks: [], documentSlide: undefined })
    })
    it(`${ADVISORY_HEADS_UP_WINDOW_DAYS} to ${ADVISORY_FINAL_WEEK_DAYS + 1} days out: one small carousel slide, no large card`, () => {
        const request = documentRequest(20)
        expect(selectHomeTasks([request], naming(request), now)).toEqual({ largeTasks: [], documentSlide: request })
        const edge = documentRequest(8)
        expect(selectHomeTasks([edge], naming(edge), now).largeTasks).toEqual([])
    })
    it(`last ${ADVISORY_FINAL_WEEK_DAYS} days, or past due: the large card, no slide`, () => {
        for (const days of [7, 3, -2]) {
            const request = documentRequest(days)
            expect(selectHomeTasks([request], naming(request), now)).toEqual({
                largeTasks: [request],
                documentSlide: undefined,
            })
        }
    })
    it('ToS and hosted tasks stay large cards whatever their date', () => {
        for (const task of [action({ effectiveDate: due(60) }), { ...hosted, effectiveDate: due(60) }]) {
            const document = documentRequest(20)
            expect(selectHomeTasks([task, document], naming(task, document), now).largeTasks).toEqual([task])
        }
    })
    it('a Manteca document request is a large Home task, as Bridge’s is', () => {
        const pep = action({ key: 'sumsub:pep_documentation', kind: 'sumsub', purpose: 'manteca-documents' })
        const report = emptyReport()
        report.local.accounts.ARS = step(pep)
        expect(selectHomeTasks([pep], report, now).largeTasks).toEqual([
            { ...pep, key: 'bridge-document:sumsub:pep_documentation' },
        ])
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

describe('selectCardDocumentTask — a card application waiting on the user', () => {
    const rainPoa = action({
        key: 'sumsub:proof_of_address',
        kind: 'sumsub',
        purpose: 'rain-card',
        levelKey: 'proof_of_address',
    })
    const rainHosted = action({ key: 'rain-hosted', kind: 'rain-hosted', purpose: 'rain-card' })
    const cardReport = (entry: FeatureReportEntry): FeatureReport => ({ ...emptyReport(), card: entry })
    it('a Rain proof-of-address ask becomes a card task, keyed apart from the shared action key', () => {
        const task = selectCardDocumentTask([rainPoa], cardReport(step(rainPoa)))
        expect(task).toEqual({ ...rainPoa, key: 'card-document:sumsub:proof_of_address' })
        expect(isCardDocumentTask(task!)).toBe(true)
        expect(isCardDocumentTask(rainPoa)).toBe(false)
    })
    it('a Rain selfie-and-ID ask (needsVerification) becomes a card task that opens the card screen', () => {
        const restart = action({
            key: 'restart-identity',
            kind: 'restart-identity',
            purpose: 'identity_verification_required',
        })
        const task = selectCardDocumentTask(
            [restart],
            cardReport({ ...step(restart), reason: 'identity_verification_required' })
        )
        expect(task).toEqual({ ...restart, key: 'card-document:restart-identity' })
        expect(isCardDocumentTask(task!)).toBe(true)
    })
    it('a restart the card shares for another cause is not a card task', () => {
        const restart = action({ key: 'restart-identity', kind: 'restart-identity', purpose: 'id_expired' })
        expect(
            selectCardDocumentTask(
                [restart],
                cardReport({ ...step(restart), reason: 'identity_document_insufficient' })
            )
        ).toBeUndefined()
    })
    it('an identity re-upload in Rain’s portal becomes a card task', () => {
        expect(selectCardDocumentTask([rainHosted], cardReport(step(rainHosted)))).toEqual({
            ...rainHosted,
            key: 'card-document:rain-hosted',
        })
    })
    it('the same proof-of-address key on a bank entry is not a card task', () => {
        expect(selectCardDocumentTask([rainPoa], naming(rainPoa))).toBeUndefined()
    })
    it('a collected proof of address waiting for review is not a task', () => {
        const wait = action({ key: 'wait:rain-poa-review', kind: 'wait', purpose: 'rain-poa-review' })
        expect(selectCardDocumentTask([wait], cardReport({ state: 'setting_up', action: wait.key }))).toBeUndefined()
    })
    it('a denied application reported as refused is not a task, even with an upload in nextActions', () => {
        expect(
            selectCardDocumentTask(
                [rainPoa],
                cardReport({ state: 'refused', reason: 'proof_of_address', action: rainPoa.key })
            )
        ).toBeUndefined()
    })
    it('asks the card screen has no button for yet (tax ID) are not tasks', () => {
        const tax = action({
            key: 'sumsub:tax_identification_number',
            kind: 'sumsub',
            purpose: 'rain-card',
            levelKey: 'tax_identification_number',
        })
        expect(selectCardDocumentTask([tax], cardReport(step(tax)))).toBeUndefined()
    })
    it('on Home it joins the large task card, so the carousel and checklist give way', () => {
        const tos = action()
        const report = { ...naming(tos), card: step(rainPoa) }
        const { largeTasks } = selectHomeTasks([tos, rainPoa], report)
        expect(largeTasks.map((task) => task.kind)).toEqual(['accept-tos', 'sumsub'])
        expect(isCardDocumentTask(largeTasks[1])).toBe(true)
    })
    it('a shared proof-of-address action named for bank and card produces both tasks', () => {
        const report = { ...naming(rainPoa), card: step(rainPoa) }
        expect(selectHomeTasks([rainPoa], report).largeTasks.map((task) => task.key)).toEqual([
            'bridge-document:sumsub:proof_of_address',
            'card-document:sumsub:proof_of_address',
        ])
    })
})
