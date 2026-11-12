import { SELF_URL } from '@/constants/general.consts'
import { isAnalyticsCaptureBuild } from '@/utils/posthog-setup'
import { marketingQrAnalyticsAllowed } from './consent'
import {
    MARKETING_QR_ENTRY_PARAM,
    getMarketingQrRegistration,
    marketingQrEventFields,
    parseMarketingQrQuery,
} from './contract'

/**
 * A QR that opens the installed app never loads the /q handoff, so the app sends the same
 * anonymous opening event. Same preference rules as /q; no cookies or account identity.
 */
export function sendMarketingQrAppOpening(url: URL): void {
    if (url.pathname !== '/home') return
    const registration = getMarketingQrRegistration(url.searchParams.get(MARKETING_QR_ENTRY_PARAM) ?? '')
    if (!registration || !isAnalyticsCaptureBuild() || !marketingQrAnalyticsAllowed()) return
    const params = new URLSearchParams(url.search)
    params.delete(MARKETING_QR_ENTRY_PARAM)
    const attribution = parseMarketingQrQuery(registration, params)
    if (!attribution.valid || typeof crypto?.randomUUID !== 'function') return
    // No keepalive: the app keeps its document while it navigates, and some webviews reject a
    // keepalive request that needs a CORS preflight.
    void fetch(`${SELF_URL}/api/marketing-qr/open`, {
        method: 'POST',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            ...marketingQrEventFields(registration, attribution),
            event_id: crypto.randomUUID(),
            opened_at: new Date().toISOString(),
        }),
    }).catch(() => {})
}
