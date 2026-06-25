'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import type { Locale } from '@/i18n/types'

const LOCALE_META: Record<Locale, { flag: string; label: string }> = {
    en: { flag: '/flags/us.svg', label: 'English' },
    'es-419': { flag: '/flags/mx.svg', label: 'Español (Latam)' },
    'es-ar': { flag: '/flags/ar.svg', label: 'Español (Argentina)' },
    'es-es': { flag: '/flags/es.svg', label: 'Español (España)' },
    'pt-br': { flag: '/flags/br.svg', label: 'Português (Brasil)' },
}
const LOCALE_ORDER: Locale[] = ['en', 'es-419', 'es-ar', 'es-es', 'pt-br']

interface Props {
    /** Display name of the parent hub (e.g. "Blog", "Stories"). */
    parentLabel: string
    /** Href of the parent hub (e.g. `/en/blog`, `/en/content?type=use-cases`). */
    parentHref: string
    /** i18n template like "Back to {name}". */
    backToTemplate: string
    /** Current URL locale. */
    currentLocale: Locale
    /** Map of every supported locale → this article's URL at that locale. */
    localizedHrefs: Record<Locale, string>
}

export function ArticleBackNav({ parentLabel, parentHref, backToTemplate, currentLocale, localizedHrefs }: Props) {
    const backLabel = backToTemplate.replace('{name}', parentLabel)
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
        <nav aria-label="Article" className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <Link
                href={parentHref}
                className="inline-flex items-center gap-2 text-sm text-grey-1 underline decoration-n-1/30 underline-offset-2 hover:text-n-1"
            >
                <span aria-hidden>←</span>
                {backLabel}
            </Link>
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
                        {LOCALE_ORDER.map((loc) => {
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
