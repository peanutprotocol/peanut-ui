import type {
    PaperworkVerificationAnswers,
    PaperworkVerificationField,
} from '@/app/actions/types/kyc-paperwork-verification.types'

/**
 * Answers typed on this device that Sumsub has not saved yet, so restarting
 * the phone before the ID check loses nothing. Scoped per account, since
 * localStorage is shared by every login on the device. A value leaves once
 * its step is saved; the rest goes at sign-out, when the ID check opens, or
 * after a week.
 */
const keyFor = (userId: string) => `peanut:kycAnswerDraft:${userId}`
const TTL_MS = 7 * 24 * 60 * 60 * 1000
// The tax number never touches storage, as nowhere else at Peanut: after a restart it is asked again.
const NEVER_KEPT = new Set(['taxId'])

type Draft = { values: PaperworkVerificationAnswers; updatedAt: number }

function read(userId: string): Draft | null {
    try {
        const raw = window.localStorage.getItem(keyFor(userId))
        if (!raw) return null
        const draft = JSON.parse(raw) as Draft
        if (!draft?.values || typeof draft.updatedAt !== 'number' || Date.now() - draft.updatedAt > TTL_MS) {
            window.localStorage.removeItem(keyFor(userId))
            return null
        }
        return draft
    } catch {
        return null
    }
}

function write(userId: string, values: PaperworkVerificationAnswers) {
    try {
        if (Object.keys(values).length)
            window.localStorage.setItem(keyFor(userId), JSON.stringify({ values, updatedAt: Date.now() }))
        else window.localStorage.removeItem(keyFor(userId))
    } catch {
        // storage unavailable (private mode, full): the answers stay in memory only
    }
}

export const readAnswerDraft = (userId: string | undefined): PaperworkVerificationAnswers =>
    (userId && read(userId)?.values) || {}

export function keepAnswerDraft(userId: string | undefined, values: PaperworkVerificationAnswers) {
    if (!userId) return
    const kept = Object.fromEntries(Object.entries(values).filter(([key]) => !NEVER_KEPT.has(key)))
    if (Object.keys(kept).length) write(userId, { ...readAnswerDraft(userId), ...kept })
}

/** Drops what a save stored; an answer edited since keeps its newer value. */
export function forgetSavedAnswers(userId: string | undefined, saved: PaperworkVerificationAnswers) {
    if (!userId) return
    const draft = readAnswerDraft(userId)
    write(userId, Object.fromEntries(Object.entries(draft).filter(([key, value]) => saved[key] !== value)))
}

export function forgetAnswerDraft(userId: string | undefined) {
    if (!userId) return
    try {
        window.localStorage.removeItem(keyFor(userId))
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
