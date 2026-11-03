import { KYC_PROCESSING_STALE_AFTER_MS } from '@/constants/kyc.consts'

export function isBridgeProcessingSlow(reasonCode?: string | null, pendingSince?: string | null): boolean {
    if (reasonCode !== 'bridge_processing' || !pendingSince) return false
    const since = Date.parse(pendingSince)
    return Number.isFinite(since) && Date.now() - since > KYC_PROCESSING_STALE_AFTER_MS
}
