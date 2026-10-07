import type { TransactionDetails } from './transactionTransformer'

export type PaymentStep =
    | 'created'
    | 'pending'
    | 'actionNeeded'
    | 'awaitingFunds'
    | 'inReview'
    | 'fundsReceived'
    | 'processing'
    | 'submitted'
    | 'awaitingSettlement'
    | 'completed'
    | 'failed'
    | 'cancelled'
    | 'refunded'
    | 'returned'
    | 'undeliverable'
    | 'readyToClaim'
    | 'claimed'

export interface PaymentTimelineStep {
    step: PaymentStep
    time?: string
    /** Planned milestones never receive invented transition timestamps. */
    state?: 'upcoming' | 'unrecorded' | 'notReached'
}

const STATES: Record<string, PaymentStep> = {
    NEW: 'pending',
    PENDING: 'pending',
    AWAITING_USER_ACTION: 'actionNeeded',
    AWAITING_SETTLEMENT: 'awaitingSettlement',
    PROCESSING: 'processing',
    COMPLETED: 'completed',
    SUCCESSFUL: 'completed',
    CLAIMED: 'claimed',
    FAILED: 'failed',
    ERROR: 'failed',
    EXPIRED: 'failed',
    CANCELLED: 'cancelled',
    CANCELED: 'cancelled',
    REFUNDED: 'refunded',
}

const BRIDGE_STATES: Record<string, PaymentStep> = {
    AWAITING_FUNDS: 'awaitingFunds',
    IN_REVIEW: 'inReview',
    FUNDS_RECEIVED: 'fundsReceived',
    PAYMENT_SUBMITTED: 'submitted',
    PAYMENT_PROCESSED: 'completed',
    UNDELIVERABLE: 'undeliverable',
    RETURNED: 'returned',
    REFUNDED: 'refunded',
    ERROR: 'failed',
    CANCELED: 'cancelled',
}

export const TERMINAL_PAYMENT_STEPS: ReadonlySet<PaymentStep> = new Set([
    'completed',
    'failed',
    'cancelled',
    'refunded',
    'returned',
    'undeliverable',
    'claimed',
])

function timestamp(value: unknown): string | undefined {
    if (!(typeof value === 'string' || value instanceof Date) || !value) return undefined
    const date = new Date(value)
    return Number.isFinite(date.getTime()) ? date.toISOString() : undefined
}

/** Build an observed history, never a predicted sequence. Skipped phases stay
 * absent; the current state has no timestamp if no transition was recorded. */
function observedPaymentTimeline(transaction: TransactionDetails): PaymentTimelineStep[] {
    if (
        transaction.isRequestPotLink ||
        transaction.extraDataForDrawer?.kind === 'PERK_REWARD' ||
        transaction.direction === 'request_sent' ||
        transaction.direction === 'request_received'
    )
        return []

    const isSendLink = transaction.extraDataForDrawer?.kind === 'SEND_LINK'
    const isBridge = transaction.extraDataForDrawer?.provider === 'BRIDGE'
    const phase = (status?: string, providerStatus?: string | null): PaymentStep | undefined => {
        const canonical = STATES[status?.toUpperCase() ?? '']
        const provider = isBridge ? BRIDGE_STATES[providerStatus?.toUpperCase() ?? ''] : undefined
        // A terminal canonical state cannot be downgraded by stale provider metadata.
        const sameOutcomeDetail =
            (canonical === 'refunded' && provider === 'returned') ||
            (canonical === 'failed' && provider === 'undeliverable')
        let step =
            canonical && TERMINAL_PAYMENT_STEPS.has(canonical)
                ? sameOutcomeDetail
                    ? provider
                    : canonical
                : (provider ?? canonical)
        if (isSendLink && step === 'completed') step = 'readyToClaim'
        return step
    }

    const result: PaymentTimelineStep[] = []
    const createdAt = timestamp(transaction.createdAt)
    if (createdAt) result.push({ step: 'created', time: createdAt })

    const events = (Array.isArray(transaction.timeline) ? transaction.timeline : [])
        .flatMap((event) => {
            if (!event || typeof event.status !== 'string') return []
            const step = phase(
                event.status,
                typeof event.providerStatus === 'string' ? event.providerStatus : undefined
            )
            const time = timestamp(event.time)
            return step && time && (!createdAt || time >= createdAt) ? [{ step, time }] : []
        })
        .sort((a, b) => a.time.localeCompare(b.time))

    const append = (step: PaymentStep, time?: string) => {
        // Provider retries can record the same user-facing phase repeatedly.
        if (result[result.length - 1]?.step !== step) result.push({ step, time })
    }
    for (const event of events) append(event.step, event.time)

    const claimedAt = timestamp(transaction.claimedAt)
    const current =
        isSendLink && transaction.status === 'cancelled'
            ? 'cancelled'
            : isSendLink && claimedAt && transaction.status === 'completed'
              ? 'claimed'
              : (phase(transaction.intentStatus, transaction.paymentStatus) ??
                phase(transaction.paymentStatus) ??
                phase(transaction.status))

    if (current) {
        const completedAt = timestamp(transaction.completedAt)
        const cancelledAt = timestamp(transaction.cancelledDate)
        const currentTime =
            current === 'claimed'
                ? claimedAt
                : current === 'cancelled'
                  ? cancelledAt
                  : current === 'completed' || current === 'readyToClaim'
                    ? completedAt
                    : undefined
        // A known terminal date may predate late webhook ingestion; don't put a
        // later milestone above it or move its timestamp to receipt creation.
        const previousTime = result.at(-1)?.time
        append(current, currentTime && (!previousTime || currentTime >= previousTime) ? currentTime : undefined)
    }
    return result
}

/** Show the route as well as the audit history. Optional provider phases (for
 * example, a review) appear when observed; the normal route stays visible. */
export function buildPaymentTimeline(transaction: TransactionDetails): PaymentTimelineStep[] {
    const observed = observedPaymentTimeline(transaction)
    if (observed.length === 0) return []

    const kind = transaction.extraDataForDrawer?.kind
    const path: PaymentStep[] =
        kind === 'SEND_LINK'
            ? ['created', 'readyToClaim', 'claimed']
            : transaction.extraDataForDrawer?.provider === 'BRIDGE'
              ? ['created', 'awaitingFunds', 'fundsReceived', 'submitted', 'completed']
              : kind === 'CARD_SPEND_AUTH' || kind === 'CARD_SPEND_CLEAR' || kind === 'CARD_AUTH_REVERSAL'
                ? ['created', 'awaitingSettlement', 'completed']
                : ['created', 'pending', 'processing', 'completed']

    const result: PaymentTimelineStep[] = []
    let cursor = 0
    for (const event of observed) {
        const index = path.indexOf(event.step)
        if (index >= cursor) {
            // A later milestone does not prove every optional earlier phase
            // happened. Missing history stays grey and explicitly unrecorded.
            for (; cursor < index; cursor++) result.push({ step: path[cursor], state: 'unrecorded' })
            cursor = index + 1
        }
        result.push(event)
    }
    const current = observed.at(-1)!.step
    const stopped = TERMINAL_PAYMENT_STEPS.has(current) && current !== 'completed' && current !== 'claimed'
    for (; cursor < path.length; cursor++) {
        result.push({ step: path[cursor], state: stopped ? 'notReached' : 'upcoming' })
    }
    return result
}
