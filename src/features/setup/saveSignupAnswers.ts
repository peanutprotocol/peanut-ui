import { isNativeBridge } from '@/utils/capacitor'
import { updateUserById } from '@/app/actions/users'
import type { SetupFundingChannel, SetupPaymentChannel } from '@/features/setup/paymentChannels'
import { storeDeclaredResidence, storeSecondResidence } from '@/utils/declared-residence.storage'
import { readStoredValue } from '@/utils/safe-storage'
import { restoreSignupValue, storeSignupValue } from './signup-storage'

const MAX_AGE = 30 * 24 * 60 * 60 * 1000
const pendingSaves = new Map<string, Promise<void>>()
const keyFor = (userId: string) => `peanut:pendingSignupAnswers:${encodeURIComponent(userId)}`
type Pending = { version: 1; userId: string; savedAt?: number; fields: Record<string, unknown> }

function readPending(userId: string): Pending | null {
    const raw = readStoredValue(keyFor(userId))
    if (!raw || raw.length > 4096) return null
    try {
        const value = JSON.parse(raw)
        if (value.savedAt !== undefined && (!Number.isFinite(value.savedAt) || Date.now() - value.savedAt > MAX_AGE)) {
            void storeSignupValue(keyFor(userId), null)
            return null
        }
        if (value.version !== 1 || value.userId !== userId || !value.fields || typeof value.fields !== 'object')
            return null
        const fields: Record<string, unknown> = {}
        for (const key of ['residenceCountry', 'nationality']) {
            if (typeof value.fields[key] === 'string' && /^[A-Z]{2}$/.test(value.fields[key]))
                fields[key] = value.fields[key]
        }
        const preferences = value.fields.signupPreferences
        if (
            preferences &&
            ['bank', 'brlBank', 'arsBank', 'crypto', 'peanut'].includes(preferences.fundingChannel) &&
            ['bank', 'crypto', 'peanut', 'card', 'qr'].includes(preferences.paymentChannel)
        ) {
            fields.signupPreferences = {
                fundingChannel: preferences.fundingChannel,
                paymentChannel: preferences.paymentChannel,
            }
        }
        return Object.keys(fields).length ? { version: 1, userId, savedAt: value.savedAt, fields } : null
    } catch {
        return null
    }
}

export function queueSignupAnswers(userId: string, fields: Record<string, unknown>): Promise<void> {
    const pending: Pending = {
        version: 1,
        userId,
        savedAt: Date.now(),
        fields: { ...readPending(userId)?.fields, ...fields },
    }
    return storeSignupValue(keyFor(userId), JSON.stringify(pending))
}

function serialize(userId: string, write: () => Promise<void>): Promise<void> {
    const previous = pendingSaves.get(userId)
    const save = (previous ? previous.then(write) : write())
        .catch(() => {})
        .finally(() => {
            if (pendingSaves.get(userId) === save) pendingSaves.delete(userId)
        })
    pendingSaves.set(userId, save)
    return save
}

async function deliver(userId: string, fields: Record<string, unknown>, onSaved?: () => void): Promise<void> {
    try {
        const result = await updateUserById({ userId, ...fields })
        const status = result?.status
        // 401 is an expired session and 408/429 are transient; any other 4xx refuses this payload for good.
        const refused = status !== undefined && status >= 400 && status < 500 && ![401, 408, 429].includes(status)
        if (result?.error && !refused) return
        const pending = readPending(userId)
        const remaining = { ...pending?.fields }
        for (const [key, value] of Object.entries(fields)) {
            if (JSON.stringify(remaining[key]) === JSON.stringify(value)) delete remaining[key]
        }
        await storeSignupValue(
            keyFor(userId),
            Object.keys(remaining).length
                ? JSON.stringify({ version: 1, userId, savedAt: pending?.savedAt ?? Date.now(), fields: remaining })
                : null
        )
        if (!result?.error) onSaved?.()
    } catch {}
}

function saveInBackground(userId: string, fields: Record<string, unknown>, onSaved?: () => void): void {
    const durable = queueSignupAnswers(userId, fields)
    void serialize(userId, () =>
        isNativeBridge?.() ? durable.then(() => deliver(userId, fields, onSaved)) : deliver(userId, fields, onSaved)
    )
}

export function flushPendingSignupAnswers(userId: string): Promise<void> {
    return serialize(userId, async () => {
        await restoreSignupValue(keyFor(userId))
        const pending = readPending(userId)
        if (pending) await deliver(userId, pending.fields)
    })
}

export const __resetSignupSavesForTests = () => pendingSaves.clear()

export function saveSignupResidence(
    userId: string,
    residenceCountry: string,
    nationality: string,
    onSaved?: () => void
): void {
    storeDeclaredResidence(userId, residenceCountry)
    storeSecondResidence(userId, null)
    saveInBackground(userId, { residenceCountry, nationality }, onSaved)
}

export function saveSignupPaymentPlan(
    userId: string,
    fundingChannel: SetupFundingChannel,
    paymentChannel: SetupPaymentChannel
): void {
    saveInBackground(userId, { signupPreferences: { fundingChannel, paymentChannel } })
}
