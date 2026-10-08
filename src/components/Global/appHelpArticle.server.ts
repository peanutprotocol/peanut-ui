import { createMdxComponents } from '@/components/Marketing/mdx/components'
import { helpArticleTitle, readPageContentLocalizedResolved, resolveContentHref } from '@/lib/content'
import { renderContent } from '@/lib/mdx'
import {
    APP_HELP_SLUGS,
    HELP_LOCALES,
    appHelpContentType,
    type AppHelpArticle,
    type AppHelpSlug,
    type HelpLocale,
    isHelpLocale,
} from './appHelpTypes'
import { serializeMdxTree } from './serializeMdxTree'

type Frontmatter = { title: string }

const readSource = (slug: AppHelpSlug, locale: HelpLocale) =>
    readPageContentLocalizedResolved<Frontmatter>(appHelpContentType(slug), slug, locale)

/** Every article with a published source, after the content locale fallback. */
export function listAppHelpArticles(): Array<{ slug: AppHelpSlug; locale: HelpLocale }> {
    return APP_HELP_SLUGS.flatMap((slug) =>
        HELP_LOCALES.filter((locale) => readSource(slug, locale) !== null).map((locale) => ({ slug, locale }))
    )
}

/**
 * Compile one help article to JSON. It runs only while the build writes the
 * static article files, so no page render and no request compiles MDX.
 */
export async function loadAppHelpArticle(slug: AppHelpSlug, locale: HelpLocale): Promise<AppHelpArticle | null> {
    const resolved = readSource(slug, locale)
    if (!resolved) return null
    const source = resolved.content

    // Stand-ins for the marketing components: the tree records their names and
    // the drawer supplies its own compact versions.
    const componentNames = new Map<unknown, string>()
    const components = Object.fromEntries(
        Object.keys(createMdxComponents(locale))
            .filter((name) => /^[A-Z]/.test(name))
            .map((name) => {
                const standIn = () => null
                componentNames.set(standIn, name)
                return [name, standIn]
            })
    )
    const { content } = await renderContent(source.body, locale, {
        components,
        stripLeadingH1: appHelpContentType(slug) === 'legal',
    })

    return {
        title: helpArticleTitle(source.frontmatter.title),
        lang: isHelpLocale(resolved.lang) ? resolved.lang : 'en',
        body: serializeMdxTree(content, {
            componentNames,
            resolveHref: (href) => resolveContentHref(href, locale),
        }),
    }
}
