'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { SUPPORTED_LOCALES, type Locale } from '@/i18n/types'
import { LOCALE_META } from '@/i18n/localeMeta'

interface Props {
    /** Current URL locale. */
    currentLocale: Locale
    /** Map of every supported locale → this article's URL at that locale. */
    localizedHrefs: Record<Locale, string>
}

/**
 * Article-top language switcher. Back navigation is NOT here — that is
 * HeroBackNav, mounted once in the (marketing) layout for every content
 * page (was ArticleBackNav until the two affordances were unified).
 */
export function ArticleLocaleNav({ currentLocale, localizedHrefs }: Props) {
    const [open, setOpen] = useState(false)
    const wrapperRef = useRef<HTMLDivElement | null>(null)
    const current = LOCALE_META[currentLocale]

    useEffect(() => {
        if (!open) return
        const onDown = (e: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false)
        }
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false)
        }
        document.addEventListener('mousedown', onDown)
        document.addEventListener('keydown', onKey)
        return () => {
            document.removeEventListener('mousedown', onDown)
            document.removeEventListener('keydown', onKey)
        }
    }, [open])

    return (
        <nav aria-label="Language" className="mb-6 flex items-center justify-end">
            <div ref={wrapperRef} className="relative">
                <button
                    type="button"
                    aria-haspopup="listbox"
                    aria-expanded={open}
                    aria-label={`Language: ${current.label}`}
                    onClick={() => setOpen((v) => !v)}
                    className="inline-flex items-center gap-1.5 rounded-sm border border-n-1 bg-white px-2 py-1 text-xs font-semibold transition-colors hover:bg-primary-3/30"
                >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={current.flag} alt="" width={18} height={18} className="rounded-full" />
                    <span aria-hidden className="text-grey-1">
                        ▾
                    </span>
                </button>
                {open && (
                    <ul
                        role="listbox"
                        className="absolute right-0 z-20 mt-1 flex flex-col overflow-hidden rounded-sm border border-n-1 bg-white shadow-[2px_2px_0_0_#000]"
                    >
                        {SUPPORTED_LOCALES.map((loc) => {
                            const meta = LOCALE_META[loc]
                            const isCurrent = loc === currentLocale
                            return (
                                <li key={loc} role="option" aria-selected={isCurrent}>
                                    <Link
                                        href={localizedHrefs[loc]}
                                        onClick={() => setOpen(false)}
                                        aria-label={meta.label}
                                        title={meta.label}
                                        className={`flex items-center justify-center px-3 py-2 transition-colors ${
                                            isCurrent ? 'bg-primary-1/20' : 'hover:bg-primary-3/30'
                                        }`}
                                    >
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={meta.flag} alt="" width={20} height={20} className="rounded-full" />
                                    </Link>
                                </li>
                            )
                        })}
                    </ul>
                )}
            </div>
        </nav>
    )
}
