import type { ScreenId } from '@/components/Setup/Setup.types'
import type { SignupProgressAnswers } from './signup-progress'
import { readStoredValue } from '@/utils/safe-storage'
import { bindInviteToUser, readInviteCode, stashInvite } from '@/utils/invite-stash'
import { EInviteType } from '@/services/services.types'
import { storeDeclaredResidence, storeSecondResidence } from '@/utils/declared-residence.storage'
import { restoreSignupValue, storeSignupValue } from './signup-storage'
import { queueSignupAnswers, flushPendingSignupAnswers } from './saveSignupAnswers'

const KEY = 'peanut:signupDraft:v2'
const MAX_AGE = 30 * 24 * 60 * 60 * 1000
const SCREENS: readonly ScreenId[] = [
    'landing',
    'advantage-fees',
    'advantage-card',
    'residence',
    'payment-plan',
    'signup',
    'invite',
    'passkey',
    'notification-email',
    'notification-permission',
    'advantage-control',
]
export type SignupDraft = {
    version: 2
    savedAt: number
    screenId: ScreenId
    answers: SignupProgressAnswers & { username: string; inviteSelection: string }
    userId?: string
    answersQueued?: boolean
    featureScreenIds?: ScreenId[]
}
type DraftInput = Pick<SignupDraft, 'screenId' | 'answers' | 'featureScreenIds'>
const country = (value: unknown) => (typeof value === 'string' && /^[A-Z]{2}$/.test(value) ? value : '')
const handle = (value: unknown) => (typeof value === 'string' && /^[a-z][a-z0-9]{3,11}$/.test(value) ? value : '')

export function readSignupDraft(): SignupDraft | null {
    const raw = readStoredValue(KEY)
    if (!raw) return null
    try {
        if (raw.length > 4096) throw new Error()
        const value = JSON.parse(raw)
        if (
            value.version !== 2 ||
            !Number.isFinite(value.savedAt) ||
            value.savedAt > Date.now() + 60000 ||
            Date.now() - value.savedAt >= MAX_AGE ||
            !SCREENS.includes(value.screenId) ||
            !value.answers ||
            typeof value.answers !== 'object'
        )
            throw new Error()
        const answers = value.answers
        const choices = answers.notificationChoices
        const notificationChoices =
            choices &&
            ['push', 'marketingPush', 'emailUpdates', 'cascaded'].every((key) => typeof choices[key] === 'boolean')
                ? {
                      push: choices.push,
                      marketingPush: choices.marketingPush,
                      emailUpdates: choices.emailUpdates,
                      cascaded: choices.cascaded,
                  }
                : null
        return {
            version: 2,
            answersQueued: value.answersQueued === true,
            savedAt: value.savedAt,
            screenId: value.screenId,
            ...(typeof value.userId === 'string' && value.userId.length <= 256 && { userId: value.userId }),
            ...(Array.isArray(value.featureScreenIds) && {
                featureScreenIds: (['advantage-fees', 'advantage-card'] as ScreenId[]).filter((id) =>
                    value.featureScreenIds.includes(id)
                ),
            }),
            answers: {
                username: handle(answers.username),
                inviteSelection: handle(answers.inviteSelection),
                residenceCountry: country(answers.residenceCountry),
                nationalityCountry: country(answers.nationalityCountry),
                fundingChannel: ['bank', 'brlBank', 'arsBank', 'crypto', 'peanut'].includes(answers.fundingChannel)
                    ? answers.fundingChannel
                    : null,
                paymentChannel: ['bank', 'crypto', 'peanut', 'card', 'qr'].includes(answers.paymentChannel)
                    ? answers.paymentChannel
                    : null,
                notificationChoices,
                inviterAccepted: answers.inviterAccepted === true,
                sellScreensCountry:
                    answers.sellScreensCountry === null ? null : country(answers.sellScreensCountry) || undefined,
            },
        }
    } catch {
        discardSignupDraft()
        return null
    }
}

export async function restoreSignupDraft(): Promise<SignupDraft | null> {
    await restoreSignupValue(KEY)
    return readSignupDraft()
}

export function saveSignupDraft(draft: DraftInput): void {
    const previous = readSignupDraft()
    void storeSignupValue(
        KEY,
        JSON.stringify({
            version: 2,
            savedAt: Date.now(),
            ...draft,
            ...(previous?.userId && { userId: previous.userId, answersQueued: previous.answersQueued }),
        })
    )
}

export function discardSignupDraft(): Promise<void> {
    return storeSignupValue(KEY, null)
}

export async function bindSignupDraft(userId: string, fallback?: DraftInput): Promise<void> {
    const draft: SignupDraft | null =
        readSignupDraft() ?? (fallback ? { version: 2 as const, savedAt: Date.now(), ...fallback } : null)
    if (!draft || (draft.userId && draft.userId !== userId)) return
    await storeSignupValue(KEY, JSON.stringify({ ...draft, userId }))
    const { answers } = draft
    const fields: Record<string, unknown> = {}
    if (answers.residenceCountry) {
        fields.residenceCountry = answers.residenceCountry
        fields.nationality = answers.nationalityCountry || answers.residenceCountry
        storeDeclaredResidence(userId, answers.residenceCountry)
        storeSecondResidence(userId, null)
    }
    if (answers.fundingChannel && answers.paymentChannel)
        fields.signupPreferences = { fundingChannel: answers.fundingChannel, paymentChannel: answers.paymentChannel }
    if (!draft.answersQueued && Object.keys(fields).length) await queueSignupAnswers(userId, fields)
    const current = readSignupDraft()
    if (current?.userId === userId) await storeSignupValue(KEY, JSON.stringify({ ...current, answersQueued: true }))
    if (answers.inviteSelection && !answers.inviterAccepted && !readInviteCode())
        stashInvite(answers.inviteSelection, EInviteType.DIRECT)
    bindInviteToUser(userId)
    void flushPendingSignupAnswers(userId)
}

export function markSignupDraftInviteAccepted(userId: string): void {
    const draft = readSignupDraft()
    if (draft?.userId !== userId) return
    void storeSignupValue(KEY, JSON.stringify({ ...draft, answers: { ...draft.answers, inviterAccepted: true } }))
}

export async function recordSignupRegistration(userId: string, username: string): Promise<void> {
    const draft = readSignupDraft()
    const normalized = username
        .trim()
        .toLowerCase()
        .replace(/\.peanut\.wallet$/, '')
    if (
        !draft ||
        draft.answers.username !== normalized ||
        !userId ||
        userId.length > 256 ||
        (draft.userId && draft.userId !== userId)
    )
        return
    await storeSignupValue(KEY, JSON.stringify({ ...draft, userId }))
}
