import type { ApplyForCardResponse } from '@/services/rain'

/**
 * The card's own step in one-shot onboarding (TASK-23329, item 9b).
 *
 * A user who ticked the card answers the four card questions (a Sumsub
 * action), accepts the cardholder agreements and calls `POST /rain/cards`.
 * That route is the one source of truth for where the card stands: every
 * answer it gives, the 4xx ones included, maps to one member here. The setup
 * drawer's card row and the Home resume card read this, never the raw answer.
 */
export type CardChainState =
    /** the four card questions are open: open the SDK on this token */
    | { kind: 'questions'; token: string }
    /** the identity check misses a step the card needs: open the SDK on this token */
    | { kind: 'identity-step'; token: string }
    /** the cardholder agreements are not accepted yet */
    | { kind: 'agreements'; isUsResident: boolean }
    /** accepted and stored; the application leaves when the identity is approved, or was sent */
    | { kind: 'setting-up' }
    /** an application exists in this state (ENABLED, REJECTED, PENDING ...): the rail says the rest */
    | { kind: 'applied'; status: string }
    /** the plan refuses the card for the document's issuing country: verify again with a local ID */
    | { kind: 'needs-local-id' }
    /** refused for another reason the user cannot change here */
    | { kind: 'not-available'; message: string; reason?: string }
    /** the issuer's answer was unclear; a person checks it; the user must not retry */
    | { kind: 'checking' }
    /** the occupation given is not one the issuer accepts */
    | { kind: 'occupation-not-accepted' }
    /** the address country contradicts the document country: the card page asks which is right */
    | { kind: 'country-confirmation'; candidates: string[] }
    | { kind: 'error'; message: string }

/** The plan's reason when a provider refuses the document's issuing country (`kyc/providers-for.ts`). */
export const DOCUMENT_COUNTRY_UNSUPPORTED = 'document_country_unsupported'

/** A non-2xx answer of `POST /rain/cards`, as `ApiError` carries it. */
export interface ApplyFailure {
    code?: string
    message: string
    /** the plan's reason on a 403 `provider-not-in-plan` */
    reason?: string
}

export function cardChainStateFromResponse(res: ApplyForCardResponse): CardChainState {
    switch (res.status) {
        case 'incomplete':
            return 'sumsubAccessToken' in res
                ? { kind: 'questions', token: res.sumsubAccessToken }
                : { kind: 'error', message: '' }
        case 'main-kyc-required':
            return 'sumsubAccessToken' in res
                ? { kind: 'identity-step', token: res.sumsubAccessToken }
                : { kind: 'error', message: '' }
        case 'terms-required':
            return { kind: 'agreements', isUsResident: 'isUsResident' in res && res.isUsResident === true }
        case 'country-confirmation-required':
            return { kind: 'country-confirmation', candidates: 'candidates' in res ? res.candidates : [] }
        case 'pending-identity':
        case 'pending':
            return { kind: 'setting-up' }
        // rainApi.applyForCard folds these two 403 codes into the success union
        case 'geo-blocked':
        case 'pending-residence-blocked':
            return { kind: 'not-available', message: 'message' in res ? res.message : '', reason: res.status }
        default:
            return { kind: 'applied', status: res.status }
    }
}

/**
 * The failure shape off any thrown value. `rainRequest` throws an `ApiError`
 * with the body as its `cause`, which is where the plan's `reason` lives.
 * Duck-typed, like `wireErrorCode`: an error that crossed a serialization
 * boundary loses its prototype.
 */
export function applyFailureOf(error: unknown): ApplyFailure {
    const thrown = (error ?? {}) as { code?: unknown; message?: unknown; cause?: unknown }
    const body = (thrown.cause ?? {}) as { reason?: unknown }
    return {
        code: typeof thrown.code === 'string' ? thrown.code : undefined,
        message: typeof thrown.message === 'string' ? thrown.message : '',
        reason: typeof body.reason === 'string' ? body.reason : undefined,
    }
}

export function cardChainStateFromFailure(failure: ApplyFailure): CardChainState {
    switch (failure.code) {
        case 'provider-not-in-plan':
            return failure.reason === DOCUMENT_COUNTRY_UNSUPPORTED
                ? { kind: 'needs-local-id' }
                : { kind: 'not-available', message: failure.message, reason: failure.reason }
        case 'geo-blocked':
        case 'pending-residence-blocked':
            return { kind: 'not-available', message: failure.message, reason: failure.code }
        case 'application-outcome-unknown':
            return { kind: 'checking' }
        case 'occupation-not-accepted':
            return { kind: 'occupation-not-accepted' }
        default:
            return { kind: 'error', message: failure.message }
    }
}

/** The states of the drawer's card row that come from the card step, not from a rail. */
export type CardRowState =
    | 'setting-up'
    | 'agreements-needed'
    | 'document-needed'
    | 'needs-local-id'
    | 'not-available'
    | 'checking'
    | 'occupation-not-accepted'

/**
 * What the card row shows for a card step, when the row's rail does not read
 * Available. Undefined leaves the rail's own state: an existing application
 * is described by its rail, and an error shows in the drawer's callout. The
 * country confirmation is a step too; "Continue card setup" takes it to the
 * card page, which has the screen for it.
 */
export function cardRowState(chain: CardChainState | null | undefined): CardRowState | undefined {
    switch (chain?.kind) {
        case 'questions':
        case 'agreements':
        case 'country-confirmation':
            return 'agreements-needed'
        case 'identity-step':
            return 'document-needed'
        case 'setting-up':
            return 'setting-up'
        case 'needs-local-id':
        case 'not-available':
        case 'checking':
        case 'occupation-not-accepted':
            return chain.kind
        default:
            return undefined
    }
}

/**
 * The card step a user can still act on by themselves, from the drawer or the
 * Home resume card: the questions, the missing identity step (both open the
 * SDK again), the agreements, the country confirmation.
 */
export function cardStepIsOpen(chain: CardChainState | null | undefined): boolean {
    return (
        chain?.kind === 'questions' ||
        chain?.kind === 'identity-step' ||
        chain?.kind === 'agreements' ||
        chain?.kind === 'country-confirmation'
    )
}
