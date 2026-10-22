import matter from 'gray-matter'
import fs from 'fs'
import path from 'path'
import { renderContent } from '@/lib/mdx'
import { getLocaleFallbacks } from '@/lib/content'

import type { Locale } from '@/i18n/types'
import type { ReactNode } from 'react'

/** Blog content lives in the peanut-content submodule at src/content/content/blog/.
 *  Structure: content/blog/{slug}/{locale}.md  (e.g. content/blog/pay-in-argentina/en.md)
 */
function getBlogDir() {
    return path.join(process.cwd(), 'src/content/content/blog')
}

export interface BlogPost {
    slug: string
    frontmatter: {
        title: string
        description: string
        date: string
        author?: string
        heroCta?: { text: string; href: string; subtitle?: string }
        faqs?: Array<{ question: string; answer: string }>
    }
    content: string
}

function coerceDate(date: unknown): string {
    if (date instanceof Date) return date.toISOString().split('T')[0]
    return String(date ?? '')
}

export function getAllPosts(locale: Locale = 'en'): BlogPost[] {
    const blogDir = getBlogDir()
    if (!fs.existsSync(blogDir)) return []

    const slugDirs = fs.readdirSync(blogDir).filter((f) => fs.statSync(path.join(blogDir, f)).isDirectory())

    return slugDirs
        .map((slug) => {
            const filePath = path.join(blogDir, slug, `${locale}.md`)
            if (!fs.existsSync(filePath)) return null

            const raw = fs.readFileSync(filePath, 'utf8')
            const { data, content } = matter(raw)
            if (data.published === false) return null
            return {
                slug,
                frontmatter: { ...data, date: coerceDate(data.date) } as BlogPost['frontmatter'],
                content,
            }
        })
        .filter((post): post is BlogPost => post !== null)
        .sort((a, b) => new Date(b.frontmatter.date).getTime() - new Date(a.frontmatter.date).getTime())
}

export async function getPostBySlug(
    slug: string,
    locale: Locale = 'en'
): Promise<{ frontmatter: BlogPost['frontmatter']; content: ReactNode; locale: Locale } | null> {
    for (const lang of getLocaleFallbacks(locale)) {
        const filePath = path.join(getBlogDir(), slug, `${lang}.md`)
        if (!fs.existsSync(filePath)) continue

        const raw = fs.readFileSync(filePath, 'utf8')
        const { data, content: body } = matter(raw)
        if (data.published === false) continue

        const contentLocale = lang as Locale
        const { content } = await renderContent(body, contentLocale)

        const frontmatter = { ...data, date: coerceDate(data.date) } as BlogPost['frontmatter']

        return { frontmatter, content, locale: contentLocale }
    }
    return null
}
