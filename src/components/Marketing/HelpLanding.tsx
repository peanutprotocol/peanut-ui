'use client'

import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import EmptyState from '@/components/Global/EmptyStates/EmptyState'
import { Notification } from '@/components/0_Bruddle/Notification'
import { SearchInput } from '@/components/SearchInput'
import { ContentLinkRow } from './ContentLinkRow'
import { PROSE_WIDTH } from './constants'

interface HelpArticle {
    slug: string
    href: string
    title: string
    description: string
    category: string
}

interface HelpLandingStrings {
    searchPlaceholder: string
    clearSearch: string
    noResults: string
    cantFind: string
    cantFindDesc: string
}

interface HelpLandingProps {
    articles: HelpArticle[]
    categories: string[]
    /** Every label comes from the page, which already holds the locale catalog.
     *  Reading '@/i18n' here instead would ship all four catalogs to the client. */
    strings: HelpLandingStrings
}

function CategoryRows({ articles }: { articles: HelpArticle[] }) {
    return (
        <div className="flex flex-col">
            {articles.map((article, i) => (
                <ContentLinkRow
                    key={article.slug}
                    href={article.href}
                    title={article.title}
                    description={article.description}
                    index={i}
                    total={articles.length}
                />
            ))}
        </div>
    )
}

export default function HelpLanding({ articles, categories, strings }: HelpLandingProps) {
    const [searchTerm, setSearchTerm] = useState('')
    const searchParams = useSearchParams()

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
                    placeholder={strings.searchPlaceholder}
                    aria-label={strings.searchPlaceholder}
                    clearLabel={strings.clearSearch}
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
                    <EmptyState icon="search" title={strings.noResults} />
                )}

                {/* Contact CTA */}
                <Notification priority="helper" title={strings.cantFind} className="my-8">
                    {strings.cantFindDesc}
                </Notification>
            </div>
        </>
    )
}
