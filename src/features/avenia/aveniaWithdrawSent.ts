import { readStoredValue, removeStoredValue, writeStoredValue } from '@/utils/safe-storage'

/**
 * Whether this device may have sent the deposit that funds a withdrawal. The
 * mark is set before the wallet signs and removed when the signature surely
 * did not go out (a dismissed passkey, a reverted transaction). The flow sends
 * the mined hash to the API (`reportFunding`), which then reads PROCESSING, so
 * the mark only covers the window before the hash mines, or a report that
 * failed: there a reload would read a sent deposit as never signed and invite
 * a second withdrawal. Without storage that window stays open.
 */
const sentKey = (intentId: string) => `avenia-withdraw-sent:${intentId}`

export function markDepositMaybeSent(intentId: string): void {
    writeStoredValue(sentKey(intentId), '1')
}

export function clearDepositMaybeSent(intentId: string): void {
    removeStoredValue(sentKey(intentId))
}

export function depositMaybeSent(intentId: string): boolean {
    return readStoredValue(sentKey(intentId)) === '1'
}
