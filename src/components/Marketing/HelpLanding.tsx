'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Icon } from '@/components/Global/Icons/Icon'
import { useModalsContext } from '@/context/ModalsContext'

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
    const { setIsSupportModalOpen } = useModalsContext()

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
        <div className="mx-auto max-w-[720px] px-6 py-12 md:px-4">
            <h1 className="text-3xl font-black md:text-4xl">Help Center</h1>
            <p className="mt-2 text-base text-grey-1">Find answers to common questions about Peanut.</p>

            {/* Search */}
            <div className="relative mt-6">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-grey-1">
                    <Icon name="search" size={18} />
                </div>
                <input
                    type="text"
                    placeholder="Search help articles..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-12 w-full rounded-sm border border-n-1 pl-10 pr-4 text-base caret-primary-1 focus:outline-none focus:ring-1 focus:ring-n-1"
                />
            </div>

            {/* Articles by category */}
            {filteredCategories.length > 0 ? (
                <div className="mt-8 flex flex-col gap-8">
                    {filteredCategories.map((category) => (
                        <section key={category}>
                            <h2 className="text-sm font-bold uppercase tracking-wide text-grey-1">{category}</h2>
                            <div className="mt-3 flex flex-col gap-2">
                                {filteredArticles
                                    .filter((a) => a.category === category)
                                    .map((article) => (
                                        <Link
                                            key={article.slug}
                                            href={`/${locale}/help/${article.slug}`}
                                            className="group flex flex-col gap-1 rounded-sm border border-n-1/10 p-4 transition-colors hover:border-n-1/30 hover:bg-n-1/[0.02]"
                                        >
                                            <h3 className="text-base font-bold group-hover:underline">
                                                {article.title}
                                            </h3>
                                            <p className="line-clamp-2 text-sm text-grey-1">{article.description}</p>
                                        </Link>
                                    ))}
                            </div>
                        </section>
                    ))}
                </div>
            ) : (
                <div className="mt-8 text-center text-grey-1">
                    <p>No articles match your search.</p>
                </div>
            )}

            {/* Contact CTA */}
            <div className="mt-12 rounded-sm border border-n-1/10 p-6 text-center">
                <h2 className="text-lg font-bold">Can&apos;t find what you need?</h2>
                <p className="mt-1 text-sm text-grey-1">
                    Chat with our support team — we typically reply within minutes.
                </p>
                <button
                    onClick={() => setIsSupportModalOpen(true)}
                    className="mt-4 rounded-sm border border-n-1 px-6 py-2 text-sm font-bold transition-colors hover:bg-n-1 hover:text-white"
                >
                    Contact Support
                </button>
            </div>
        </div>
    )
}
