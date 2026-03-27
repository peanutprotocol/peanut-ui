import matter from 'gray-matter'
import fs from 'fs'
import path from 'path'
import { renderContent } from '@/lib/mdx'

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
        category?: string
        author?: string
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
): Promise<{ frontmatter: BlogPost['frontmatter']; content: ReactNode } | null> {
    const filePath = path.join(getBlogDir(), slug, `${locale}.md`)
    if (!fs.existsSync(filePath)) return null

    const raw = fs.readFileSync(filePath, 'utf8')
    const { data, content: body } = matter(raw)

    const { content } = await renderContent(body)

    const frontmatter = { ...data, date: coerceDate(data.date) } as BlogPost['frontmatter']

    return { frontmatter, content }
}

export function getPostsByCategory(category: string, locale: Locale = 'en'): BlogPost[] {
    return getAllPosts(locale).filter((p) => p.frontmatter.category === category)
}

export function getAllCategories(locale: Locale = 'en'): string[] {
    const posts = getAllPosts(locale)
    const cats = new Set(posts.map((p) => p.frontmatter.category).filter(Boolean) as string[])
    return Array.from(cats).sort()
}
