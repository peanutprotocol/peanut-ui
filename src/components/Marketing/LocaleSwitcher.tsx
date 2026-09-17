'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useId, useRef, useState } from 'react'
import { HREFLANG_MAP, isValidLocale } from '@/i18n/config'
import { LOCALE_META } from '@/i18n/localeMeta'
import { toAppLocale } from '@/i18n/localeBridge'
import { persistLocale } from '@/i18n/app/locale-store'
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale } from '@/i18n/types'
import { CARD_SURFACE } from '@/components/0_Bruddle/Card'
import { Icon } from '@/components/Global/Icons/Icon'

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

// Fixed so the trigger keeps its size whichever language is selected. 176px
// is what the longest label (Espanol (AR)) needs beside a flag and a chevron.
const TRIGGER_WIDTH = 'w-44'

const FOCUS_RING = 'focus-visible:outline-[3px] focus-visible:outline-action-focus focus-visible:outline-solid'

/**
 * The one language picker for the marketing site — the top bar of every
 * localized page and both footer slots. Label plus flag: the label is what a
 * reader scans for, the flag is what they recognise at a glance.
 *
 * Every label stays in its own language, so someone who cannot read the
 * current locale can still find theirs.
 */
export function LocaleSwitcher({ locale, label }: { locale: Locale; label: string }) {
    const pathname = usePathname() ?? '/'
    const [open, setOpen] = useState(false)
    // /content keeps its filters in the query string (`?type=blog&q=fees`), so
    // dropping it silently resets the list the reader is looking at. (The help
    // hub holds its search in state, so it has nothing to carry.) Read from the
    // browser at open time rather than through useSearchParams: that hook opts
    // every caller's route out of static prerender unless the caller adds its
    // own Suspense boundary, and the options only exist after a click, so they
    // are always post-hydration.
    const [search, setSearch] = useState('')
    const listId = useId()
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
                aria-expanded={open}
                aria-controls={listId}
                aria-label={`${label}: ${LOCALE_META[locale].label}`}
                onClick={() => {
                    setSearch(window.location.search)
                    setOpen((v) => !v)
                }}
                className={`${TRIGGER_WIDTH} ${CARD_SURFACE} ${FOCUS_RING} inline-flex min-h-11 items-center gap-2 px-3 py-2 text-body-s-semibold text-foreground-primary transition-colors duration-instant hover:bg-background-page active:bg-action-primary`}
            >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={LOCALE_META[locale].flag} alt="" width={20} height={20} className="shrink-0 rounded-full" />
                <span className="truncate">{LOCALE_META[locale].shortLabel}</span>
                <Icon name="chevron-down" size={16} className="ml-auto shrink-0 text-foreground-secondary" />
            </button>
            {open && (
                // A disclosure holding a list of links, not a listbox: every row
                // navigates, and a focusable link cannot be a listbox option.
                // Tab walks the links, Escape closes — no roving focus to fake.
                <ul
                    id={listId}
                    className={`${TRIGGER_WIDTH} ${CARD_SURFACE} shadow-2 absolute top-full right-0 z-30 mt-1 flex flex-col overflow-hidden`}
                >
                    {SUPPORTED_LOCALES.map((loc) => {
                        const meta = LOCALE_META[loc]
                        const isCurrent = loc === locale
                        return (
                            <li key={loc}>
                                <Link
                                    href={`${localeHref(pathname, loc)}${search}`}
                                    hrefLang={HREFLANG_MAP[loc]}
                                    aria-current={isCurrent ? 'true' : undefined}
                                    // The full label carries the region the short
                                    // one drops, so a screen reader still tells
                                    // Español (Latam) from Español (Argentina).
                                    aria-label={meta.label}
                                    title={meta.label}
                                    // Same cookie the product UI reads, so a choice made
                                    // on marketing carries into the app and back.
                                    onClick={() => {
                                        persistLocale(toAppLocale(loc))
                                        setOpen(false)
                                    }}
                                    className={`${FOCUS_RING} flex min-h-11 items-center gap-2 px-3 py-2 text-body-s whitespace-nowrap text-foreground-primary transition-colors duration-instant ${
                                        isCurrent ? 'bg-action-primary/20' : 'hover:bg-background-page'
                                    }`}
                                >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={meta.flag}
                                        alt=""
                                        width={20}
                                        height={20}
                                        className="shrink-0 rounded-full"
                                    />
                                    <span className="truncate">{meta.shortLabel}</span>
                                </Link>
                            </li>
                        )
                    })}
                </ul>
            )}
        </div>
    )
}
