import { BASE_URL } from '@/constants/general.consts'

const baseUrl = BASE_URL || 'https://peanut.me'

export function faqSchema(faqs: { question: string; answer: string }[]) {
    if (faqs.length === 0) return null

    return {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqs.map((faq) => ({
            '@type': 'Question',
            name: faq.question,
            acceptedAnswer: {
                '@type': 'Answer',
                text: faq.answer,
            },
        })),
    }
}

export interface ArticleMeta {
    title: string
    description: string
    url: string
    datePublished: string
    dateModified?: string
}

export function articleSchema({ title, description, url, datePublished, dateModified }: ArticleMeta) {
    return {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: title,
        description,
        url: `${baseUrl}${url}`,
        datePublished,
        dateModified: dateModified ?? datePublished,
        author: {
            '@type': 'Organization',
            name: 'Peanut',
            url: baseUrl,
        },
        publisher: {
            '@type': 'Organization',
            name: 'Peanut',
            url: baseUrl,
        },
    }
}
