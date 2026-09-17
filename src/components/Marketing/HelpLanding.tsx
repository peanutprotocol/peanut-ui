'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Icon } from '@/components/Global/Icons/Icon'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { getCardPosition } from '@/components/Global/Card/card.utils'
import EmptyState from '@/components/Global/EmptyStates/EmptyState'
import { Notification } from '@/components/0_Bruddle/Notification'
import { SearchInput } from '@/components/SearchInput'
import { PROSE_WIDTH } from './mdx/constants'
import { getTranslations } from '@/i18n'
import { useUrlLocale } from '@/i18n/useUrlLocale'

interface HelpArticle {
    slug: string
    href: string
    title: string
    description: string
    category: string
}

interface HelpLandingStrings {
    searchPlaceholder: string
    cantFind: string
    cantFindDesc: string
}

interface HelpLandingProps {
    articles: HelpArticle[]
    categories: string[]
    strings?: HelpLandingStrings
}

// rows are anchors, not onClick handlers: help articles have to stay crawlable,
// so ListItem sits inside a Link — which is also why ListGroup, whose cloneElement
// would put `position` on the anchor, cannot own the grouping here.
function CategoryRows({ articles }: { articles: HelpArticle[] }) {
    return (
        <div className="flex flex-col">
            {articles.map((article, i) => (
                <Link key={article.slug} href={article.href} className="group block">
                    <ListItem
                        position={getCardPosition(i, articles.length)}
                        title={<h3 className="truncate group-hover:underline">{article.title}</h3>}
                        body={article.description}
                        trailing={<Icon name="arrow-up-right" size={20} className="text-foreground-secondary" />}
                        className="transition-colors duration-instant group-hover:bg-background-disabled"
                    />
                </Link>
            ))}
        </div>
    )
}

export default function HelpLanding({ articles, categories, strings }: HelpLandingProps) {
    const [searchTerm, setSearchTerm] = useState('')
    const searchParams = useSearchParams()
    // the page passes `strings`, but this is a localized surface and the hub is
    // also reachable without them — read the same dictionary the page reads
    // instead of falling back to english.
    const i18n = getTranslations(useUrlLocale())

    // Auto-open Crisp chat when ?chat=open (e.g. redirected from /support)
    useEffect(() => {
        if (searchParams.get('chat') !== 'open') return
        const interval = setInterval(() => {
            if (window.$crisp) {
                window.$crisp.push(['do', 'chat:open'])
                clearInterval(interval)
            }
        }, 200)
        return () => clearInterval(interval)
    }, [searchParams])

    const filteredArticles = useMemo(() => {
        if (!searchTerm.trim()) return articles

        const lower = searchTerm.toLowerCase().trim()
        return articles.filter(
            (a) =>
                a.title.toLowerCase().includes(lower) ||
                a.description.toLowerCase().includes(lower) ||
                a.category.toLowerCase().includes(lower)
        )
    }, [articles, searchTerm])

    const filteredCategories = useMemo(() => {
        const activeCats = new Set(filteredArticles.map((a) => a.category))
        return categories.filter((c) => activeCats.has(c))
    }, [categories, filteredArticles])

    return (
        <>
            {/* Search */}
            <div className={`mx-auto mt-10 mb-8 ${PROSE_WIDTH} px-6 md:mt-12 md:px-4`}>
                <SearchInput
                    value={searchTerm}
                    onChange={setSearchTerm}
                    onClear={() => setSearchTerm('')}
                    placeholder={strings?.searchPlaceholder ?? i18n.searchHelpArticles}
                    aria-label={strings?.searchPlaceholder ?? i18n.searchHelpArticles}
                    clearLabel={i18n.clearSearch}
                />
            </div>

            {/* Articles by category */}
            <div className={`mx-auto ${PROSE_WIDTH} px-6 md:px-4`}>
                {filteredCategories.length > 0 ? (
                    <div className="flex flex-col gap-10">
                        {filteredCategories.map((category) => (
                            <section key={category}>
                                <h2 className="mb-4 text-label-m tracking-widest text-foreground-secondary uppercase">
                                    {category}
                                </h2>
                                <CategoryRows articles={filteredArticles.filter((a) => a.category === category)} />
                            </section>
                        ))}
                    </div>
                ) : (
                    <EmptyState icon="search" title={i18n.noContentResults} />
                )}

                {/* Contact CTA */}
                <Notification priority="helper" title={strings?.cantFind ?? i18n.cantFindAnswer} className="my-8">
                    {strings?.cantFindDesc ?? i18n.cantFindAnswerDesc}
                </Notification>
            </div>
        </>
    )
}
