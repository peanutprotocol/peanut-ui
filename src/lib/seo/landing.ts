import { type Metadata } from 'next'
import { generateMetadata as metadataHelper } from '@/app/metadata'
import { getLandingAlternates } from '@/i18n/config'
import { DEFAULT_LOCALE, type Locale } from '@/i18n/types'
import { readSingletonContentLocalized, type ContentFrontmatter } from '@/lib/content'

// English canonical is `/`; other locales are `/{locale}`.
function canonicalFor(locale: Locale): string {
    return locale === DEFAULT_LOCALE ? '/' : `/${locale}`
}

/** Metadata for a landing route, sourced from content/landing/{locale}.md frontmatter. */
export function landingMetadata(locale: Locale): Metadata {
    const content = readSingletonContentLocalized<ContentFrontmatter>('landing', locale)
    const canonical = canonicalFor(locale)

    return {
        ...metadataHelper({
            title: content?.frontmatter.title ?? 'Peanut',
            description: content?.frontmatter.description ?? '',
            canonical,
        }),
        alternates: {
            canonical,
            languages: getLandingAlternates(),
        },
    }
}
