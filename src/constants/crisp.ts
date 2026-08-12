/**
 * Crisp chat integration configuration
 */
import type { AppLocale } from '@/i18n/app/config'
import type { CrispUserData } from '@/hooks/useCrispUserData'

/** Crisp website ID for Peanut's support chat */
export const CRISP_WEBSITE_ID = '916078be-a6af-4696-82cb-bc08d43d9125'

/** Support inbox — the mailto fallback when the Crisp chatbox fails to load. */
export const SUPPORT_EMAIL = 'help@peanut.me'

/* Crisp chatbox locales (https://docs.crisp.chat — CRISP_RUNTIME_CONFIG.locale)
   are lowercase and coarser than the app's; both Spanish variants map to "es". */
export const CRISP_LOCALE_BY_APP_LOCALE: Record<AppLocale, string> = {
    en: 'en',
    'es-419': 'es',
    'es-AR': 'es',
    'pt-BR': 'pt-br',
}

/* Handshake message types between SupportDrawer and the crisp-proxy iframe.
   Shared constants so a rename can't silently break one side (both sides
   switch on event.data.type). */
export const CRISP_PROXY_REQUEST_INIT_MSG = 'CRISP_PROXY_REQUEST_INIT'
export const CRISP_PROXY_INIT_MSG = 'CRISP_PROXY_INIT'

/**
 * Init payload the crisp-proxy iframe pulls from its parent via postMessage
 * (and receives again on later changes — the channel is also the update path).
 * Never put any of this in the iframe URL: a query string leaks into Vercel
 * logs, browser history, Referer headers, and the $current_url of every
 * analytics event fired from the iframe document (2026-08-10 postmortem F5).
 */
export interface CrispInitPayload {
    locale: string
    /** Crisp session-continuity token — a bearer credential; URL-leaking it allows thread hijack. */
    tokenId?: string
    userData?: CrispUserData
    prefilledMessage?: string
}
