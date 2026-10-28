import { randomUUID } from 'node:crypto'
import { STORE_NAME, STORE_URL } from '@/constants/migration.consts'
import { marketingQrAnalyticsAllowed } from './consent'
import { marketingQrContinuation, type MarketingQrAttribution, type MarketingQrRegistration } from './contract'

type HandoffState = {
    captureEnabled: boolean
    projectKey: string
    allowedContinuation: string
    deniedContinuation: string
    event: Record<string, string>
}

/** Self-contained: serialized into the standalone response, outside the app layout. */
export function runMarketingQrHandoff(state: HandoffState, checkConsent: (key: string) => boolean): void {
    let started = false
    const doc = document as Document & { prerendering?: boolean }
    const run = () => {
        if (started) return
        if (doc.prerendering) {
            doc.addEventListener('prerenderingchange', run, { once: true })
            return
        }
        started = true
        const allowed = state.captureEnabled && checkConsent(state.projectKey)
        try {
            if (allowed && typeof crypto.randomUUID === 'function') {
                const body = { ...state.event, event_id: crypto.randomUUID(), opened_at: new Date().toISOString() }
                void fetch('/api/marketing-qr/open', {
                    method: 'POST',
                    credentials: 'omit',
                    keepalive: true,
                    referrerPolicy: 'no-referrer',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                }).catch(() => {})
            }
        } catch {
            // A blocked transport must not strand the visitor.
        } finally {
            window.location.replace(allowed ? state.allowedContinuation : state.deniedContinuation)
        }
    }
    run()
}

function escapeHtml(value: string): string {
    return value.replace(
        /[&<>"']/g,
        (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!
    )
}

export async function renderMarketingQrHandoff(
    registration: MarketingQrRegistration,
    attribution: MarketingQrAttribution,
    captureEnabled: boolean
) {
    // Only these two labels enter the HTML; translation bundles stay on the server.
    const messages =
        registration.locale === 'es-ar'
            ? (await import('@/i18n/app/messages/es-AR.json')).default
            : registration.locale === 'es-419'
              ? (await import('@/i18n/app/messages/es-419.json')).default
              : registration.locale === 'pt-br'
                ? (await import('@/i18n/app/messages/pt-BR.json')).default
                : (await import('@/i18n/app/messages/en.json')).default
    const state: HandoffState = {
        captureEnabled,
        projectKey: process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim() ?? '',
        allowedContinuation: marketingQrContinuation(registration, attribution.campaign, true),
        deniedContinuation: marketingQrContinuation(registration, attribution.campaign, false),
        event: {
            qr_id: registration.qr_id,
            utm_source: attribution.campaign.source,
            utm_medium: attribution.campaign.medium,
            utm_campaign: attribution.campaign.campaign,
            ...(attribution.campaign.content ? { utm_content: attribution.campaign.content } : {}),
            attribution_origin: attribution.attributionOrigin,
            attribution_adjustment: attribution.attributionAdjustment,
        },
    }
    const nonce = randomUUID()
    const serialized = JSON.stringify(state)
        .replace(/</g, '\\u003c')
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029')
    const script = `(${runMarketingQrHandoff.toString()})(${serialized},${marketingQrAnalyticsAllowed.toString()});`
    // Strip Apple campaign tokens from the no-JS/manual fallback links. The fallback sits in
    // <noscript>: with JavaScript the page stays blank until the script continues, instead of
    // flashing unstyled links.
    const stores = Object.entries(STORE_URL)
        .map(([store, url]) => {
            const target = new URL(url)
            if (store === 'ios') target.search = ''
            return `<p><a href="${escapeHtml(target.toString())}" rel="noreferrer">${STORE_NAME[store as keyof typeof STORE_NAME]}</a></p>`
        })
        .join('')
    return {
        html: `<!doctype html><html lang="${registration.locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="referrer" content="no-referrer"><title>${escapeHtml(messages.migration.qr.title)}</title></head><body><noscript><main><h1>${escapeHtml(messages.migration.qr.title)}</h1><p>${escapeHtml(messages.migration.smartLink.pickStore)}</p>${stores}</main></noscript><script nonce="${nonce}">${script}</script></body></html>`,
        csp: `default-src 'none'; script-src 'nonce-${nonce}'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'`,
    }
}
