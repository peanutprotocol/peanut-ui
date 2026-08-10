'use client'

import { type ReactNode } from 'react'
import { useLocale } from 'next-intl'
import { isCapacitor, openExternalUrl } from '@/utils/capacitor'
import { BASE_URL } from '@/constants/general.consts'

interface DocsLinkProps {
    /** App-relative path to web-only content, e.g. `/en/help/transaction-limits`, `/terms`. */
    href: string
    className?: string
    children: ReactNode
    'aria-label'?: string
}

/**
 * Re-point an `/en/…` href at the app locale's marketing twin so a Spanish
 * user tapping "Docs" lands on Spanish pages. App locales lowercase onto the
 * marketing URL codes (pt-BR → pt-br), and the marketing fallback chains
 * guarantee a missing translation serves fallback prose rather than a 404.
 * Non-`/en/` hrefs (bare `/terms`, absolute URLs) pass through untouched.
 */
export function localizeDocsHref(href: string, appLocale: string): string {
    const marketingLocale = appLocale.toLowerCase()
    if (marketingLocale === 'en') return href
    if (href === '/en' || href.startsWith('/en/')) return `/${marketingLocale}${href.slice(3)}`
    return href
}

/**
 * Link to web-only pages (help center, legal) that don't exist in the native
 * static export. On web it's a normal new-tab link; in Capacitor those routes
 * 404 → SPA falls back to home, so we open the absolute production URL in the
 * in-app browser instead.
 *
 * An `/en/…` path is retargeted at the reader's app locale, so call sites can
 * keep writing the canonical English path.
 */
export default function DocsLink({ href, className, children, ...rest }: DocsLinkProps) {
    const locale = useLocale()
    const localizedHref = localizeDocsHref(href, locale)

    return (
        <a
            href={localizedHref}
            target="_blank"
            rel="noopener noreferrer"
            className={className}
            onClick={(e) => {
                if (isCapacitor()) {
                    e.preventDefault()
                    void openExternalUrl(`${BASE_URL}${localizedHref}`)
                }
            }}
            {...rest}
        >
            {children}
        </a>
    )
}
