import matter from 'gray-matter'
import { marked } from 'marked'
import { createHighlighter, type Highlighter } from 'shiki'
import fs from 'fs'
import path from 'path'

import type { Locale } from '@/i18n/types'

function getBlogDir(locale: Locale = 'en') {
    return path.join(process.cwd(), `src/content/blog/${locale}`)
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

// Singleton highlighter — created once, reused across all posts
let _highlighter: Highlighter | null = null

async function getHighlighter(): Promise<Highlighter> {
    if (_highlighter) return _highlighter
    _highlighter = await createHighlighter({
        themes: ['github-light'],
        langs: ['javascript', 'typescript', 'bash', 'json', 'yaml', 'html', 'css', 'python', 'solidity'],
    })
    return _highlighter
}

export function getAllPosts(locale: Locale = 'en'): BlogPost[] {
    const dir = getBlogDir(locale)
    if (!fs.existsSync(dir)) return []

    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md'))
    return files
        .map((file) => {
            const raw = fs.readFileSync(path.join(dir, file), 'utf8')
            const { data, content } = matter(raw)
            return {
                slug: file.replace('.md', ''),
                frontmatter: data as BlogPost['frontmatter'],
                content,
            }
        })
        .sort((a, b) => new Date(b.frontmatter.date).getTime() - new Date(a.frontmatter.date).getTime())
}

export async function getPostBySlug(
    slug: string,
    locale: Locale = 'en'
): Promise<{ frontmatter: BlogPost['frontmatter']; html: string } | null> {
    const filePath = path.join(getBlogDir(locale), `${slug}.md`)
    if (!fs.existsSync(filePath)) return null

    const raw = fs.readFileSync(filePath, 'utf8')
    const { data, content } = matter(raw)

    const highlighter = await getHighlighter()

    // Custom renderer for code blocks with shiki syntax highlighting
    const renderer = new marked.Renderer()
    renderer.code = ({ text, lang }: { text: string; lang?: string }) => {
        const language = lang || 'text'
        try {
            return highlighter.codeToHtml(text, {
                lang: language,
                theme: 'github-light',
            })
        } catch {
            // Fallback for unsupported languages
            return `<pre><code class="language-${language}">${text}</code></pre>`
        }
    }

    const html = (await marked(content, { renderer })) as string

    return { frontmatter: data as BlogPost['frontmatter'], html }
}

export function getPostsByCategory(category: string, locale: Locale = 'en'): BlogPost[] {
    return getAllPosts(locale).filter((p) => p.frontmatter.category === category)
}

export function getAllCategories(locale: Locale = 'en'): string[] {
    const posts = getAllPosts(locale)
    const cats = new Set(posts.map((p) => p.frontmatter.category).filter(Boolean) as string[])
    return Array.from(cats).sort()
}
