import type { ScreenId } from '@/components/Setup/Setup.types'
import { postRegistrationScreen } from '@/hooks/useSetupFlow'
import { readStoredValue, removeStoredValue, writeStoredValue } from '@/utils/safe-storage'
import type { NotificationChoices } from './SetupFlowContext'
import type { SetupFundingChannel, SetupPaymentChannel } from './paymentChannels'

/** The steps after registration; reaching any of them arms the no-back lock. */
export const POST_REGISTRATION_SCREENS: readonly ScreenId[] = [
    'residence',
    'invite',
    'advantage-fees',
    'advantage-card',
    'payment-plan',
    'notification-email',
    'notification-permission',
    'advantage-control',
]

const FUNDING_CHANNELS: readonly SetupFundingChannel[] = ['bank', 'brlBank', 'arsBank', 'crypto', 'peanut']
const PAYMENT_CHANNELS: readonly SetupPaymentChannel[] = ['bank', 'crypto', 'peanut', 'card', 'qr']
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000
const COUNTRY = /^[A-Z]{2}$/

/**
 * The answers a signup gave after registration, kept on the device so a
 * reload or an app restart continues where the person left. The email is not
 * here: the server has it and the email step prefills from the profile.
 */
export interface SignupProgressAnswers {
    residenceCountry: string
    nationalityCountry: string
    fundingChannel: SetupFundingChannel | null
    paymentChannel: SetupPaymentChannel | null
    /** Only once the person changed a switch: untouched choices keep the step's own defaults. */
    notificationChoices: NotificationChoices | null
    inviterAccepted: boolean
    sellScreensCountry: string | null | undefined
}

export interface SignupProgress {
    screenId: ScreenId
    answers: SignupProgressAnswers
}

interface StoredSignupProgress extends SignupProgress {
    version: 1
    savedAt: number
}

const keyFor = (userId: string) => `peanut:signupProgress:${userId}`

const country = (value: unknown): string => (typeof value === 'string' && COUNTRY.test(value) ? value : '')

const oneOf = <T extends string>(values: readonly T[], value: unknown): T | null =>
    values.includes(value as T) ? (value as T) : null

function notificationChoices(value: unknown): NotificationChoices | null {
    if (!value || typeof value !== 'object') return null
    const choices = value as Record<string, unknown>
    const keys = ['push', 'marketingPush', 'emailUpdates', 'cascaded'] as const
    if (!keys.every((key) => typeof choices[key] === 'boolean')) return null
    return {
        push: choices.push as boolean,
        marketingPush: choices.marketingPush as boolean,
        emailUpdates: choices.emailUpdates as boolean,
        cascaded: choices.cascaded as boolean,
    }
}

export function saveSignupProgress(userId: string, progress: SignupProgress, now = Date.now()): void {
    const stored: StoredSignupProgress = { version: 1, savedAt: now, ...progress }
    writeStoredValue(keyFor(userId), JSON.stringify(stored))
}

export function readSignupProgress(userId: string, now = Date.now()): SignupProgress | null {
    const raw = readStoredValue(keyFor(userId))
    if (!raw) return null
    try {
        const stored = JSON.parse(raw) as Partial<StoredSignupProgress>
        const answers = (stored.answers ?? {}) as Partial<Record<keyof SignupProgressAnswers, unknown>>
        if (
            stored.version !== 1 ||
            typeof stored.savedAt !== 'number' ||
            now - stored.savedAt > MAX_AGE_MS ||
            !POST_REGISTRATION_SCREENS.includes(stored.screenId as ScreenId)
        ) {
            removeStoredValue(keyFor(userId))
            return null
        }
        return {
            screenId: stored.screenId as ScreenId,
            answers: {
                residenceCountry: country(answers.residenceCountry),
                nationalityCountry: country(answers.nationalityCountry),
                fundingChannel: oneOf(FUNDING_CHANNELS, answers.fundingChannel),
                paymentChannel: oneOf(PAYMENT_CHANNELS, answers.paymentChannel),
                notificationChoices: notificationChoices(answers.notificationChoices),
                inviterAccepted: answers.inviterAccepted === true,
                sellScreensCountry:
                    answers.sellScreensCountry === null
                        ? null
                        : country(answers.sellScreensCountry) || undefined,
            },
        }
    } catch {
        removeStoredValue(keyFor(userId))
        return null
    }
}

export function clearSignupProgress(userId: string): void {
    removeStoredValue(keyFor(userId))
}

/**
 * Where a signup interrupted after registration continues: the saved step when
 * it is still in the list, else the next later step that is, else the first
 * step after registration. A step can leave the list between sessions (the
 * inviter question once an inviter is on the account).
 */
export function resumeScreen(
    progress: SignupProgress | null,
    screenIds: readonly ScreenId[],
    masterScreenIds: readonly ScreenId[]
): ScreenId {
    const first = postRegistrationScreen(screenIds)
    if (!progress) return first
    if (screenIds.includes(progress.screenId)) return progress.screenId
    const savedIndex = masterScreenIds.indexOf(progress.screenId)
    const later = screenIds.find(
        (id) => POST_REGISTRATION_SCREENS.includes(id) && masterScreenIds.indexOf(id) > savedIndex
    )
    return later ?? first
}
