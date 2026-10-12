import { loadAppHelpArticle, listAppHelpArticles } from '@/components/Global/appHelpArticle.server'
import { isAppHelpSlug, isHelpLocale } from '@/components/Global/appHelpTypes'

// Written to static files at build time, for the web deploy and the native
// export alike. The in-app help drawer fetches one file when it opens.
export const dynamic = 'force-static'
export const dynamicParams = false

export function generateStaticParams() {
    return listAppHelpArticles().map(({ slug, locale }) => ({ locale, article: `${slug}.json` }))
}

export async function GET(_request: Request, { params }: { params: Promise<{ locale: string; article: string }> }) {
    const { locale, article } = await params
    const slug = article.replace(/\.json$/, '')
    const document = isHelpLocale(locale) && isAppHelpSlug(slug) ? await loadAppHelpArticle(slug, locale) : null
    if (!document) return new Response(null, { status: 404 })
    return Response.json(document)
}
