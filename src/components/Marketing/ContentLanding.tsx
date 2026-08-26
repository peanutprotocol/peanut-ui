'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import Fuse from 'fuse.js'
import { useQueryStates, parseAsString, parseAsStringEnum } from 'nuqs'
import { Icon } from '@/components/Global/Icons/Icon'
import type { ContentItem, ContentItemType } from '@/lib/content'
import type { Locale } from '@/i18n/types'

const PROSE_WIDTH = 'max-w-[720px]'
const TYPE_VALUES: ContentItemType[] = ['blog', 'stories', 'use-cases', 'compare']

export interface ContentLandingStrings {
    searchPlaceholder: string
    noResults: string
    filterAll: string
    filterBlog: string
    filterStories: string
    filterUseCases: string
    filterCompare: string
}

interface Props {
    items: ContentItem[]
    locale: Locale
    strings: ContentLandingStrings
}

interface ContentLinkListProps {
    items: ContentItem[]
    strings: ContentLandingStrings
    /** Group by type under section headings — the unfiltered hub view. */
    grouped: boolean
}

// Generated frontmatter titles carry the " | Peanut" suffix that <title> wants and the card
// doesn't. Strip it for display only — the frontmatter, the sitemap and page metadata keep
// reading the raw value. The suffix is a convention, so fall back to the title as authored.
function displayTitle(title: string): string {
    const stripped = title.replace(/\s*\|\s*Peanut\s*$/i, '').trim()
    return stripped || title
}

function typeLabelsFor(strings: ContentLandingStrings): Record<ContentItemType, string> {
    return {
        blog: strings.filterBlog,
        stories: strings.filterStories,
        'use-cases': strings.filterUseCases,
        compare: strings.filterCompare,
    }
}

function renderLinkRows(items: ContentItem[]) {
    return (
        <div className="flex flex-col gap-px overflow-hidden rounded-sm border border-n-1">
            {items.map((item) => (
                <Link
                    key={`${item.type}/${item.slug}`}
                    href={item.href}
                    className="group flex items-center justify-between border-b border-n-1/10 bg-white px-5 py-4 transition-colors last:border-b-0 hover:bg-primary-3/20"
                >
                    <div className="flex flex-col gap-0.5">
                        <h3 className="text-base font-semibold text-n-1 group-hover:underline">
                            {displayTitle(item.title)}
                        </h3>
                        <p className="line-clamp-1 text-sm leading-[1.75] text-grey-1">{item.description}</p>
                    </div>
                    <Icon name="arrow-up-right" size={16} className="shrink-0 text-grey-1" />
                </Link>
            ))}
        </div>
    )
}

/**
 * The results half of the hub — plain links, no URL state. ContentLanding renders it once
 * filtering has run, and the page renders it as the Suspense fallback: a subtree that reads the
 * URL prerenders as its fallback, so this is what puts article links in the crawlable HTML.
 */
export function ContentLinkList({ items, strings, grouped }: ContentLinkListProps) {
    const typeLabels = typeLabelsFor(strings)

    return (
        <div className={`mx-auto ${PROSE_WIDTH} px-6 pb-12 md:px-4`}>
            {grouped ? (
                <div className="flex flex-col gap-10">
                    {TYPE_VALUES.map((t) => {
                        const inType = items.filter((i) => i.type === t)
                        if (inType.length === 0) return null
                        return (
                            <section key={t}>
                                <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-grey-1">
                                    {typeLabels[t]}
                                </h2>
                                {renderLinkRows(inType)}
                            </section>
                        )
                    })}
                </div>
            ) : (
                renderLinkRows(items)
            )}
        </div>
    )
}

export default function ContentLanding({ items, strings }: Props) {
    const [{ q, type }, setFilters] = useQueryStates({
        q: parseAsString,
        type: parseAsStringEnum<ContentItemType>(TYPE_VALUES),
    })

    const activeType: ContentItemType | null = type

    const inTypeScope = useMemo(
        () => (activeType ? items.filter((i) => i.type === activeType) : items),
        [items, activeType]
    )

    const fuse = useMemo(
        () =>
            new Fuse(inTypeScope, {
                keys: ['title', 'description', 'tags'],
                threshold: 0.35,
                ignoreLocation: true,
            }),
        [inTypeScope]
    )

    const filtered = useMemo(() => {
        const query = q?.trim() ?? ''
        if (!query) return inTypeScope
        return fuse.search(query).map((r) => r.item)
    }, [q, inTypeScope, fuse])

    const groupResults = !activeType

    const typeLabels = typeLabelsFor(strings)

    const chipBase = 'rounded-sm border border-n-1 px-3 py-1 text-sm transition-colors'

    return (
        <>
            <div className={`mx-auto mb-6 mt-10 ${PROSE_WIDTH} px-6 md:mt-12 md:px-4`}>
                <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-grey-1">
                        <Icon name="search" size={18} />
                    </div>
                    <input
                        type="text"
                        aria-label={strings.searchPlaceholder}
                        placeholder={strings.searchPlaceholder}
                        value={q ?? ''}
                        onChange={(e) => setFilters({ q: e.target.value || null })}
                        className="h-12 w-full rounded-sm border border-n-1 bg-white pl-10 pr-4 text-base caret-primary-1 focus:outline-none focus:ring-1 focus:ring-n-1"
                    />
                </div>
            </div>

            <div className={`mx-auto mb-4 ${PROSE_WIDTH} px-6 md:px-4`}>
                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={() => setFilters({ type: null })}
                        className={`${chipBase} ${activeType === null ? 'bg-primary-1/20 font-semibold' : 'hover:bg-primary-3/30'}`}
                    >
                        {strings.filterAll}
                    </button>
                    {TYPE_VALUES.map((t) => (
                        <button
                            key={t}
                            type="button"
                            onClick={() => setFilters({ type: activeType === t ? null : t })}
                            className={`${chipBase} ${activeType === t ? 'bg-primary-1/20 font-semibold' : 'hover:bg-primary-3/30'}`}
                        >
                            {typeLabels[t]}
                        </button>
                    ))}
                </div>
            </div>

            {filtered.length === 0 ? (
                <div className={`mx-auto ${PROSE_WIDTH} px-6 pb-12 md:px-4`}>
                    <p className="py-12 text-center text-grey-1">{strings.noResults}</p>
                </div>
            ) : (
                <ContentLinkList items={filtered} strings={strings} grouped={groupResults} />
            )}
        </>
    )
}
