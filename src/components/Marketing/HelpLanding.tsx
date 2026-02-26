'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Icon } from '@/components/Global/Icons/Icon'

interface HelpArticle {
    slug: string
    title: string
    description: string
    category: string
}

interface HelpLandingProps {
    articles: HelpArticle[]
    categories: string[]
    locale: string
}

export default function HelpLanding({ articles, categories, locale }: HelpLandingProps) {
    const [searchTerm, setSearchTerm] = useState('')
    const searchParams = useSearchParams()

    // Auto-open Crisp chat when ?chat=open (e.g. redirected from /support)
    useEffect(() => {
        if (searchParams.get('chat') === 'open' && window.$crisp) {
            window.$crisp.push(['do', 'chat:open'])
        }
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
        <article className="content-page select-text bg-background">
            {/* Hero */}
            <div className="mx-auto mb-5 mt-10 max-w-[640px] px-6 md:mt-12 md:px-4">
                <h1 className="text-2xl font-extrabold text-n-1 md:text-3xl">Help Center</h1>
                <p className="mb-6 mt-3 text-base leading-[1.75] text-grey-1">
                    Find answers to common questions about Peanut.
                </p>

                {/* Search */}
                <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-grey-1">
                        <Icon name="search" size={18} />
                    </div>
                    <input
                        type="text"
                        placeholder="Search help articles..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="h-12 w-full rounded-sm border border-n-1 bg-white pl-10 pr-4 text-base caret-primary-1 focus:outline-none focus:ring-1 focus:ring-n-1"
                    />
                </div>
            </div>

            {/* Articles by category */}
            <div className="mx-auto max-w-[640px] px-6 pb-12 md:px-4">
                {filteredCategories.length > 0 ? (
                    <div className="flex flex-col gap-10">
                        {filteredCategories.map((category) => (
                            <section key={category}>
                                <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-grey-1">
                                    {category}
                                </h2>
                                <div className="flex flex-col gap-px overflow-hidden rounded-sm border border-n-1">
                                    {filteredArticles
                                        .filter((a) => a.category === category)
                                        .map((article) => (
                                            <Link
                                                key={article.slug}
                                                href={`/${locale}/help/${article.slug}`}
                                                className="group flex items-center justify-between border-b border-n-1/10 bg-white px-5 py-4 transition-colors last:border-b-0 hover:bg-primary-3/20"
                                            >
                                                <div className="flex flex-col gap-0.5">
                                                    <h3 className="text-base font-semibold text-n-1 group-hover:underline">
                                                        {article.title}
                                                    </h3>
                                                    <p className="line-clamp-1 text-sm leading-[1.75] text-grey-1">
                                                        {article.description}
                                                    </p>
                                                </div>
                                                <Icon
                                                    name="arrow-up-right"
                                                    size={16}
                                                    className="shrink-0 text-grey-1"
                                                />
                                            </Link>
                                        ))}
                                </div>
                            </section>
                        ))}
                    </div>
                ) : (
                    <div className="py-12 text-center text-grey-1">
                        <p className="text-base">No articles match your search.</p>
                    </div>
                )}

                {/* Contact CTA */}
                <div className="mt-14 border-l-4 border-primary-1 py-1 pl-6 pr-6 md:pr-4">
                    <p className="text-base font-semibold text-n-1">Can&apos;t find what you need?</p>
                    <p className="mt-1 text-base leading-[1.75] text-grey-1">
                        Click the chat bubble in the bottom-right corner to talk to our support team. We typically reply
                        within minutes.
                    </p>
                </div>
            </div>
        </article>
    )
}
