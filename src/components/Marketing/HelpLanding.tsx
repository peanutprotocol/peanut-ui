'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Icon } from '@/components/Global/Icons/Icon'

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

const PROSE_WIDTH = 'max-w-[640px]'

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
                <div className="relative">
                    <div className="absolute top-1/2 left-3 -translate-y-1/2 text-foreground-secondary">
                        <Icon name="search" size={18} />
                    </div>
                    <input
                        type="text"
                        aria-label={strings?.searchPlaceholder ?? 'Search help articles'}
                        placeholder={strings?.searchPlaceholder ?? 'Search help articles...'}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="h-12 w-full rounded-sm border border-border-default bg-background-default pr-4 pl-10 text-base caret-action-primary focus:ring-1 focus:ring-border-default focus:outline-none"
                    />
                </div>
            </div>

            {/* Articles by category */}
            <div className={`mx-auto ${PROSE_WIDTH} px-6 md:px-4`}>
                {filteredCategories.length > 0 ? (
                    <div className="flex flex-col gap-10">
                        {filteredCategories.map((category) => (
                            <section key={category}>
                                <h2 className="mb-4 text-xs font-bold tracking-widest text-foreground-secondary uppercase">
                                    {category}
                                </h2>
                                <div className="flex flex-col gap-px overflow-hidden rounded-sm border border-border-default">
                                    {filteredArticles
                                        .filter((a) => a.category === category)
                                        .map((article) => (
                                            <Link
                                                key={article.slug}
                                                href={article.href}
                                                className="group flex items-center justify-between border-b border-border-default/10 bg-background-default px-4 py-4 transition-colors last:border-b-0 hover:bg-primary-3/20"
                                            >
                                                <div className="flex flex-col gap-0.5">
                                                    <h3 className="text-base font-semibold text-foreground-primary group-hover:underline">
                                                        {article.title}
                                                    </h3>
                                                    <p className="line-clamp-1 text-sm leading-[1.75] text-foreground-secondary">
                                                        {article.description}
                                                    </p>
                                                </div>
                                                <Icon
                                                    name="arrow-up-right"
                                                    size={16}
                                                    className="shrink-0 text-foreground-secondary"
                                                />
                                            </Link>
                                        ))}
                                </div>
                            </section>
                        ))}
                    </div>
                ) : (
                    <div className="py-12 text-center text-foreground-secondary">
                        <p className="text-base">No articles match your search.</p>
                    </div>
                )}

                {/* Contact CTA */}
                <div className="my-8 border-l-4 border-action-primary py-1 pl-6">
                    <p className="font-semibold text-foreground-primary">
                        {strings?.cantFind ?? "Can't find what you need?"}
                    </p>
                    <p className="mt-1 text-base leading-[1.75] text-foreground-secondary">
                        {strings?.cantFindDesc ??
                            'Click the chat bubble in the bottom-right corner to talk to our support team. We typically reply within minutes.'}
                    </p>
                </div>
            </div>
        </>
    )
}
