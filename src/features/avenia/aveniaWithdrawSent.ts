import { readStoredValue, removeStoredValue, writeStoredValue } from '@/utils/safe-storage'

/**
 * Whether this device may have sent the deposit that funds a withdrawal. The
 * mark is set before the wallet signs and removed when the signature surely
 * did not go out (a dismissed passkey, a reverted transaction). The API sees a
 * deposit only once the app reports it or Rhino holds it, so after a reload the
 * mark is what keeps a deposit sent a moment ago from reading as never signed,
 * which would invite a second withdrawal.
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
