'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { HREFLANG_MAP, isValidLocale } from '@/i18n/config'
import { LOCALE_META } from '@/i18n/localeMeta'
import { toAppLocale } from '@/i18n/localeBridge'
import { persistLocale } from '@/i18n/app/locale-store'
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale } from '@/i18n/types'
import { CARD_SURFACE } from '@/components/0_Bruddle/Card'

/**
 * Same-page href for `target`.
 *
 * Marketing routes are all `/{locale}/rest`, so switching swaps the first
 * segment. Paths whose first segment is NOT a locale (`/`, `/lp`, `/careers`)
 * have no localized twin, so they resolve to that locale's landing
 * instead of inventing a `/es-419/lp` that would 404. English landing is `/`,
 * not `/en` — `/en` redirects.
 */
export function localeHref(pathname: string, target: Locale): string {
    const segments = pathname.split('/').filter(Boolean)
    const rest = isValidLocale(segments[0] ?? '') ? segments.slice(1) : []
    if (rest.length === 0) return target === DEFAULT_LOCALE ? '/' : `/${target}`
    return `/${target}/${rest.join('/')}`
}

// Fixed so the trigger keeps its size whichever language is selected.
const TRIGGER_WIDTH = 'w-40'

export function LocaleSwitcher({ locale, label }: { locale: Locale; label: string }) {
    const pathname = usePathname() ?? '/'
    const [open, setOpen] = useState(false)
    const wrapperRef = useRef<HTMLDivElement | null>(null)

    // Attached once on mount rather than whenever `open` flips. Binding it on
    // open means the listener goes live while the click that opened the menu is
    // still being dispatched, so it catches that same interaction and closes the
    // menu again — it opens and vanishes before it paints. A stable listener has
    // no such race: a click on the trigger is inside the wrapper, so this never
    // fires for it, and the button's own onClick owns the toggle.
    useEffect(() => {
        const onDown = (e: Event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false)
        }
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false)
        }
        document.addEventListener('pointerdown', onDown)
        document.addEventListener('keydown', onKey)
        return () => {
            document.removeEventListener('pointerdown', onDown)
            document.removeEventListener('keydown', onKey)
        }
    }, [])

    return (
        <div ref={wrapperRef} className="relative">
            <button
                type="button"
                aria-haspopup="true"
                aria-expanded={open}
                aria-label={`${label}: ${LOCALE_META[locale].shortLabel}`}
                onClick={() => setOpen((v) => !v)}
                className={`${TRIGGER_WIDTH} ${CARD_SURFACE} inline-flex items-center justify-between px-3 py-1.5 text-sm font-semibold text-foreground-primary transition-colors hover:border-gray-0 hover:bg-gray-950 hover:text-foreground-inverse`}
            >
                {LOCALE_META[locale].shortLabel}
                <span aria-hidden className="text-foreground-secondary">
                    ▾
                </span>
            </button>
            {open && (
                <ul
                    className={`${TRIGGER_WIDTH} ${CARD_SURFACE} shadow-2 absolute top-full right-0 z-30 mt-1 flex flex-col overflow-hidden`}
                >
                    {SUPPORTED_LOCALES.map((loc) => {
                        const isCurrent = loc === locale
                        return (
                            <li key={loc}>
                                <Link
                                    href={localeHref(pathname, loc)}
                                    hrefLang={HREFLANG_MAP[loc]}
                                    // Same cookie the product UI reads, so a choice made
                                    // on marketing carries into the app and back.
                                    onClick={() => {
                                        persistLocale(toAppLocale(loc))
                                        setOpen(false)
                                    }}
                                    className={`block px-3 py-2 text-sm whitespace-nowrap transition-colors hover:bg-gray-950 hover:text-foreground-inverse ${
                                        isCurrent
                                            ? 'bg-action-primary/20 font-bold text-foreground-primary'
                                            : 'text-foreground-primary'
                                    }`}
                                >
                                    {LOCALE_META[loc].shortLabel}
                                </Link>
                            </li>
                        )
                    })}
                </ul>
            )}
        </div>
    )
}
