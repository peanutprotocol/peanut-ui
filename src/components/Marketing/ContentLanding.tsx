'use client'

import { useMemo } from 'react'
import Fuse from 'fuse.js'
import { useQueryStates, parseAsString, parseAsStringEnum } from 'nuqs'
import EmptyState from '@/components/Global/EmptyStates/EmptyState'
import { SearchInput } from '@/components/SearchInput'
import { Tabs } from '@/components/0_Bruddle/Tabs'
import { ContentLinkRow } from './ContentLinkRow'
import { HUB_WIDTH } from './constants'
import type { ContentItem, ContentItemType } from '@/lib/content'
import type { Locale } from '@/i18n/types'

const TYPE_VALUES: ContentItemType[] = ['blog', 'stories', 'use-cases', 'compare']

// the "no type filter" tab. Not a ContentItemType, and not '' — radix rejects an empty
// tab value. It never reaches the URL: onValueChange maps it back to `type: null`.
const ALL_VALUE = 'all'

export interface ContentLandingStrings {
    searchPlaceholder: string
    clearSearch: string
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
        <div className="flex flex-col">
            {items.map((item, i) => (
                <ContentLinkRow
                    key={`${item.type}/${item.slug}`}
                    href={item.href}
                    title={displayTitle(item.title)}
                    description={item.description}
                    index={i}
                    total={items.length}
                />
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
        <div className={`mx-auto ${HUB_WIDTH} px-6 pb-12 md:px-4`}>
            {grouped ? (
                <div className="flex flex-col gap-10">
                    {TYPE_VALUES.map((t) => {
                        const inType = items.filter((i) => i.type === t)
                        if (inType.length === 0) return null
                        return (
                            <section key={t}>
                                <h2 className="mb-4 text-label-m tracking-widest text-foreground-secondary uppercase">
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

    return (
        <>
            <div className={`mx-auto mt-10 mb-6 ${HUB_WIDTH} px-6 md:mt-12 md:px-4`}>
                <SearchInput
                    value={q ?? ''}
                    onChange={(value) => setFilters({ q: value || null })}
                    onClear={() => setFilters({ q: null })}
                    placeholder={strings.searchPlaceholder}
                    aria-label={strings.searchPlaceholder}
                    clearLabel={strings.clearSearch}
                />
            </div>

            <div className={`mx-auto mb-4 ${HUB_WIDTH} px-6 md:px-4`}>
                {/* nuqs owns the value: ?type=blog is a shareable filtered URL, so the
                    tabs read and write the query state directly and hold none of their own.
                    ALL_VALUE stands in for `type=null` because a radix tab value cannot be
                    empty. */}
                <Tabs
                    aria-label={strings.filterAll}
                    value={activeType ?? ALL_VALUE}
                    onValueChange={(next) =>
                        setFilters({ type: next === ALL_VALUE ? null : (next as ContentItemType) })
                    }
                    tabs={[
                        { value: ALL_VALUE, label: strings.filterAll },
                        ...TYPE_VALUES.map((t) => ({ value: t, label: typeLabels[t] })),
                    ]}
                />
            </div>

            {filtered.length === 0 ? (
                <div className={`mx-auto ${HUB_WIDTH} px-6 pb-12 md:px-4`}>
                    <EmptyState icon="search" title={strings.noResults} />
                </div>
            ) : (
                <ContentLinkList items={filtered} strings={strings} grouped={groupResults} />
            )}
        </>
    )
}
