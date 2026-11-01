import type {
    PaperworkVerificationAnswers,
    PaperworkVerificationField,
} from '@/app/actions/types/kyc-paperwork-verification.types'
import type { IUserProfile } from '@/interfaces/interfaces'

/**
 * Answers typed on this device that Sumsub has not saved yet, so restarting
 * the phone before the ID check loses nothing. Scoped per account, since
 * localStorage is shared by every login on the device. A value leaves once
 * its step is saved; the rest goes at sign-out, when the session is lost,
 * when the ID check opens, when the declared residence changes, or after a
 * week.
 */
const PREFIX = 'peanut:kycAnswerDraft:'
const keyFor = (userId: string) => `${PREFIX}${userId}`
const TTL_MS = 7 * 24 * 60 * 60 * 1000
// The tax number never touches storage, as nowhere else at Peanut: after a restart it is asked again.
const NEVER_KEPT = new Set(['taxId'])

/** `residence`: the residence the account had declared when the answers were typed. */
type Draft = { values: PaperworkVerificationAnswers; updatedAt: number; residence?: string | null }

function parse(raw: string | null): Draft | null {
    if (!raw) return null
    try {
        const draft = JSON.parse(raw) as Draft
        if (!draft?.values || typeof draft.updatedAt !== 'number' || Date.now() - draft.updatedAt > TTL_MS) return null
        return draft
    } catch {
        return null
    }
}

function read(userId: string): Draft | null {
    try {
        const raw = window.localStorage.getItem(keyFor(userId))
        const draft = parse(raw)
        if (raw && !draft) window.localStorage.removeItem(keyFor(userId))
        return draft
    } catch {
        return null
    }
}

function write(userId: string, values: PaperworkVerificationAnswers, residence: string | null | undefined) {
    try {
        if (Object.keys(values).length)
            window.localStorage.setItem(
                keyFor(userId),
                JSON.stringify({ values, updatedAt: Date.now(), residence: residence ?? null })
            )
        else window.localStorage.removeItem(keyFor(userId))
    } catch {
        // storage unavailable (private mode, full): the answers stay in memory only
    }
}

/** The declared residence a draft is kept under; undefined while it is unknown (an API without the field). */
export const draftResidenceOf = (
    user: Pick<IUserProfile, 'residence'> | null | undefined
): string | null | undefined => (user?.residence ? (user.residence.declared?.country ?? null) : undefined)

/** An unknown residence keeps the draft; a different one means the answers were for another country. */
const typedUnder = (draft: Draft, residence: string | null | undefined) =>
    residence === undefined || (draft.residence ?? null) === residence

function current(userId: string, residence: string | null | undefined): Draft | null {
    const draft = read(userId)
    if (!draft || typedUnder(draft, residence)) return draft
    forgetAnswerDraft(userId)
    return null
}

export const readAnswerDraft = (userId: string | undefined, residence?: string | null): PaperworkVerificationAnswers =>
    (userId && current(userId, residence)?.values) || {}

export function keepAnswerDraft(
    userId: string | undefined,
    values: PaperworkVerificationAnswers,
    residence?: string | null
) {
    if (!userId) return
    const kept = Object.fromEntries(Object.entries(values).filter(([key]) => !NEVER_KEPT.has(key)))
    if (!Object.keys(kept).length) return
    const draft = current(userId, residence)
    write(userId, { ...draft?.values, ...kept }, residence === undefined ? draft?.residence : residence)
}

/** Drops what a save stored; an answer edited since keeps its newer value. */
export function forgetSavedAnswers(userId: string | undefined, saved: PaperworkVerificationAnswers) {
    if (!userId) return
    const draft = read(userId)
    if (!draft) return
    write(
        userId,
        Object.fromEntries(Object.entries(draft.values).filter(([key, value]) => saved[key] !== value)),
        draft.residence
    )
}

export function forgetAnswerDraft(userId: string | undefined | null) {
    if (!userId) return
    try {
        window.localStorage.removeItem(keyFor(userId))
    } catch {}
}

/** Drops the account's draft once its declared residence is no longer the one the answers were typed under. */
export function forgetAnswerDraftOnResidenceChange(userId: string | undefined, residence: string | null | undefined) {
    if (userId) current(userId, residence)
}

/** Removes every account's expired draft, not only the one that signs in next. */
export function sweepExpiredAnswerDrafts() {
    try {
        const keys: string[] = []
        for (let index = 0; index < window.localStorage.length; index++) {
            const key = window.localStorage.key(index)
            if (key?.startsWith(PREFIX)) keys.push(key)
        }
        for (const key of keys) if (!parse(window.localStorage.getItem(key))) window.localStorage.removeItem(key)
    } catch {}
}

/** The server's saved values win; a draft fills only what the server has no value for. */
export const withAnswerDraft = (
    values: PaperworkVerificationAnswers,
    fields: PaperworkVerificationField[],
    draft: PaperworkVerificationAnswers
): PaperworkVerificationAnswers => {
    const out = { ...values }
    for (const f of fields) if (!f.value && !f.locked && draft[f.key]) out[f.key] = draft[f.key]
    return out
}
