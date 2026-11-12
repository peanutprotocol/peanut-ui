import { isNativeBridge } from '@/utils/capacitor'
import { updateUserById } from '@/app/actions/users'
import type { SetupFundingChannel, SetupPaymentChannel } from '@/features/setup/paymentChannels'
import { storeDeclaredResidence, storeSecondResidence } from '@/utils/declared-residence.storage'
import { readStoredValue } from '@/utils/safe-storage'
import { restoreSignupValue, storeSignupValue } from './signup-storage'

const pendingSaves = new Map<string, Promise<void>>()
const keyFor = (userId: string) => `peanut:pendingSignupAnswers:${encodeURIComponent(userId)}`
type Pending = { version: 1; userId: string; fields: Record<string, unknown> }

function readPending(userId: string): Pending | null {
    const raw = readStoredValue(keyFor(userId))
    if (!raw || raw.length > 4096) return null
    try {
        const value = JSON.parse(raw)
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
        return Object.keys(fields).length ? { version: 1, userId, fields } : null
    } catch {
        return null
    }
}

export function queueSignupAnswers(userId: string, fields: Record<string, unknown>): Promise<void> {
    const pending: Pending = { version: 1, userId, fields: { ...readPending(userId)?.fields, ...fields } }
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
        if (result?.error) return
        const remaining = { ...readPending(userId)?.fields }
        for (const [key, value] of Object.entries(fields)) {
            if (JSON.stringify(remaining[key]) === JSON.stringify(value)) delete remaining[key]
        }
        await storeSignupValue(
            keyFor(userId),
            Object.keys(remaining).length ? JSON.stringify({ version: 1, userId, fields: remaining }) : null
        )
        onSaved?.()
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
