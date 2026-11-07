import { BASE_URL } from '@/constants/general.consts'
import { IOS_APP_STORE_ID } from '@/constants/migration.consts'
import { isNoindexRoute } from '@/constants/seo-route-policy'
import { OG_LOCALE_MAP } from '@/i18n/config'
import { type Locale } from '@/i18n/types'
import { type Metadata } from 'next'

/**
 * Safari's Smart App Banner. The app gets the page's canonical URL, never the
 * request URL: reading the query string would make static pages dynamic.
 */
export function smartAppBanner(canonical: string): NonNullable<Metadata['itunes']> {
    return { appId: IOS_APP_STORE_ID, appArgument: new URL(canonical, BASE_URL).href }
}

export function generateMetadata({
    title,
    description,
    image = '/metadata-img.png',
    dynamicOg = false,
    ogSubtitle,
    ogTitle,
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
    /** Headline on the dynamic OG image. Defaults to `title`. */
    ogTitle?: string
    keywords?: string
    /** Canonical URL path (e.g. '/careers') or full URL. Resolved against metadataBase. */
    canonical?: string
    /**
     * Language of the page's prose — emits og:locale + og:locale:alternate.
     * Content routes pass the locale whose file serves the page, not the URL
     * locale: a pt-br URL served from the English file is English.
     */
    locale?: Locale
}): Metadata {
    const ogImage = dynamicOg
        ? `/api/og/marketing?title=${encodeURIComponent(ogTitle ?? title)}${ogSubtitle ? `&subtitle=${encodeURIComponent(ogSubtitle)}` : ''}`
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
            // the generated card's alt is its own text, not the page title
            images: [{ url: ogImage, width: 1200, height: 630, alt: dynamicOg ? (ogTitle ?? title) : title }],
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
        // Public pages only: app routes have no canonical or sit under an app prefix.
        ...(canonical && !isNoindexRoute(new URL(canonical, BASE_URL).pathname)
            ? { itunes: smartAppBanner(canonical) }
            : {}),
    }
}
