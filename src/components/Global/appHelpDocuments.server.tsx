import { APP_HELP_SLUGS, type AppHelpDocuments, type AppHelpSlug } from './appHelpTypes'
import { createAppHelpMdxComponents } from './AppHelpMdx'
import { readPageContentLocalized } from '@/lib/content'
import { renderContent } from '@/lib/mdx'
import type { Locale } from '@/i18n/types'

type Frontmatter = { title: string; published?: boolean }
const HELP_LOCALES = ['en', 'es-419', 'es-ar', 'pt-br'] as const satisfies readonly Locale[]

async function helpDocument(slug: AppHelpSlug, locale: Locale) {
    const source = readPageContentLocalized<Frontmatter>('help', slug, locale)
    if (!source || source.frontmatter.published === false)
        throw new Error(`Missing app help document: ${slug}/${locale}`)
    const { content } = await renderContent(source.body, locale, {
        components: createAppHelpMdxComponents(locale),
    })
    return {
        title: source.frontmatter.title.replace(/\s*\|\s*Peanut(?: Help)?$/, ''),
        content,
    }
}

/** Compile help articles into the static app bundle; native routes cannot fetch the public help pages. */
export async function loadAppHelpDocuments(): Promise<AppHelpDocuments> {
    const entries = await Promise.all(
        APP_HELP_SLUGS.map(async (slug) => {
            const localized = await Promise.all(HELP_LOCALES.map((locale) => helpDocument(slug, locale)))
            return [slug, Object.fromEntries(HELP_LOCALES.map((locale, index) => [locale, localized[index]]))] as const
        })
    )
    return Object.fromEntries(entries) as AppHelpDocuments
}
