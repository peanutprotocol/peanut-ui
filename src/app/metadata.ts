import { BASE_URL } from '@/constants/general.consts'
import { OG_LOCALE_MAP } from '@/i18n/config'
import { type Locale } from '@/i18n/types'
import { type Metadata } from 'next'

export function generateMetadata({
    title,
    description,
    image = '/metadata-img.png',
    dynamicOg = false,
    ogSubtitle,
    keywords,
    canonical,
    locale,
}: {
    title: string
    description: string
    image?: string
    /** Generate a branded OG image dynamically from the title */
    dynamicOg?: boolean
    /** Subtitle shown on dynamic OG image */
    ogSubtitle?: string
    keywords?: string
    /** Canonical URL path (e.g. '/careers') or full URL. Resolved against metadataBase. */
    canonical?: string
    /** Marketing locale of the page — emits og:locale + og:locale:alternate. */
    locale?: Locale
}): Metadata {
    const ogImage = dynamicOg
        ? `/api/og/marketing?title=${encodeURIComponent(title)}${ogSubtitle ? `&subtitle=${encodeURIComponent(ogSubtitle)}` : ''}`
        : image

    return {
        title,
        description,
        metadataBase: new URL(BASE_URL),
        icons: { icon: '/favicon.ico' },
        keywords,
        openGraph: {
            type: 'website',
            title,
            description,
            url: canonical ? `${BASE_URL}${canonical}` : BASE_URL,
            siteName: 'Peanut',
            images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
            ...(locale
                ? {
                      locale: OG_LOCALE_MAP[locale],
                      alternateLocale: Object.entries(OG_LOCALE_MAP)
                          .filter(([key]) => key !== locale)
                          .map(([, value]) => value),
                  }
                : {}),
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
            images: [ogImage],
            creator: '@joinpeanut',
            site: '@joinpeanut',
        },
        applicationName: process.env.NODE_ENV === 'development' ? 'Peanut Dev' : 'Peanut',
        ...(canonical ? { alternates: { canonical } } : {}),
    }
}
