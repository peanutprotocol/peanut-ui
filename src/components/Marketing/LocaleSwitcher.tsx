'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { HREFLANG_MAP, isValidLocale } from '@/i18n/config'
import { LOCALE_META } from '@/i18n/localeMeta'
import { toAppLocale } from '@/i18n/localeBridge'
import { persistLocale } from '@/i18n/app/locale-store'
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale } from '@/i18n/types'

/**
 * Same-page href for `target`.
 *
 * Marketing routes are all `/{locale}/rest`, so switching swaps the first
 * segment. Paths whose first segment is NOT a locale (`/`, `/lp`, `/exchange`,
 * `/quests`) have no localized twin, so they resolve to that locale's landing
 * instead of inventing a `/es-419/lp` that would 404. English landing is `/`,
 * not `/en` — `/en` redirects.
 */
export function localeHref(pathname: string, target: Locale): string {
    const segments = pathname.split('/').filter(Boolean)
    const rest = isValidLocale(segments[0] ?? '') ? segments.slice(1) : []
    if (rest.length === 0) return target === DEFAULT_LOCALE ? '/' : `/${target}`
    return `/${target}/${rest.join('/')}`
}

/**
 * Exact-locale content renders its own availability-aware switcher. The global
 * footer cannot inspect server-side content files, so it must stay out of the
 * way instead of inventing links to missing locale variants.
 */
export function hasRouteScopedLocaleSwitcher(pathname: string): boolean {
    const segments = pathname.split('/').filter(Boolean)
    return (
        isValidLocale(segments[0] ?? '') && segments[1] === 'split' && segments[2] === 'guides' && segments.length > 3
    )
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

    if (hasRouteScopedLocaleSwitcher(pathname)) return null

    return (
        <div ref={wrapperRef} className="relative">
            <button
                type="button"
                aria-haspopup="true"
                aria-expanded={open}
                aria-label={`${label}: ${LOCALE_META[locale].shortLabel}`}
                onClick={() => setOpen((v) => !v)}
                className={`${TRIGGER_WIDTH} inline-flex items-center justify-between rounded-sm border border-n-1 bg-white px-3 py-1.5 text-sm font-semibold text-n-1 transition-colors hover:border-white hover:bg-black hover:text-white`}
            >
                {LOCALE_META[locale].shortLabel}
                <span aria-hidden className="text-grey-1">
                    ▾
                </span>
            </button>
            {open && (
                <ul
                    className={`${TRIGGER_WIDTH} absolute right-0 top-full z-30 mt-1 flex flex-col overflow-hidden rounded-sm border border-n-1 bg-white shadow-[2px_2px_0_0_#000]`}
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
                                    className={`block whitespace-nowrap px-3 py-2 text-sm transition-colors hover:bg-black hover:text-white ${
                                        isCurrent ? 'bg-primary-1/20 font-bold text-n-1' : 'text-n-1'
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
