import { readStoredValue, writeStoredValue } from '@/utils/safe-storage'

/**
 * Cards this device's own add flow found in its wallet. Bridges the gap until
 * Rain reports the token; it does not survive a reinstall or follow the
 * account to another phone, so it only ever confirms a native last-four match.
 */
const KEY = 'peanut:walletAddedCards'
const MAX_CARDS = 10

function readCardIds(): string[] {
    try {
        const parsed: unknown = JSON.parse(readStoredValue(KEY) ?? '[]')
        return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
    } catch {
        return []
    }
}

export function wasCardAddedOnThisDevice(cardId: string): boolean {
    return readCardIds().includes(cardId)
}

export function rememberCardAddedOnThisDevice(cardId: string): void {
    const ids = readCardIds().filter((id) => id !== cardId)
    writeStoredValue(KEY, JSON.stringify([...ids, cardId].slice(-MAX_CARDS)))
}
