import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import type { RhinoChainType } from '@/services/services.types'
import { readStoredValue, writeStoredValue } from '@/utils/safe-storage'
import posthog from 'posthog-js'

/** deposits already reported, so a surface that sees an outcome another one reported does not count it twice */
const SENT_KEY = 'deposit_completed_sent_v1'
const SENT_KEEP = 50

const depositKey = (address: string, txHash: string | undefined, amount: number) =>
    `${address.toLowerCase()}:${txHash?.toLowerCase() ?? `amount:${amount}`}`

const readSent = (): string[] => {
    try {
        const stored = JSON.parse(readStoredValue(SENT_KEY) ?? '[]')
        return Array.isArray(stored) ? stored : []
    } catch {
        return []
    }
}

/**
 * The deposit event every crypto add-money surface sends, so deposit charts count them all alike. With
 * `deposit` it is sent once per deposit across the /add-money/crypto page and the card drawer: by its
 * transaction, or without one by its amount until the address's status is cleared (then the next deposit
 * of the same amount is a new one).
 */
export function captureCryptoDepositCompleted(
    amount: number,
    network: RhinoChainType,
    invitedBy: string | null | undefined,
    deposit?: { address: string; txHash?: string }
) {
    if (deposit) {
        const key = depositKey(deposit.address, deposit.txHash, amount)
        const sent = readSent()
        if (sent.includes(key)) return
        writeStoredValue(SENT_KEY, JSON.stringify([...sent, key].slice(-SENT_KEEP)))
    }
    posthog.capture(ANALYTICS_EVENTS.DEPOSIT_COMPLETED, {
        amount,
        chain_type: network,
        method_type: 'crypto',
        acquisition_source: invitedBy ? 'referred' : 'organic',
    })
}

/** The address's status was cleared: a later deposit of the same amount with no transaction is a new one. */
export function forgetCryptoDepositsAt(address: string) {
    const prefix = `${address.toLowerCase()}:amount:`
    const sent = readSent()
    const kept = sent.filter((key) => !key.startsWith(prefix))
    if (kept.length !== sent.length) writeStoredValue(SENT_KEY, JSON.stringify(kept))
}
