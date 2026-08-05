import { compileMDX } from 'next-mdx-remote/rsc'
import remarkGfm from 'remark-gfm'
import { createMdxComponents } from '@/components/Marketing/mdx/components'
import { DEFAULT_LOCALE, type Locale } from '@/i18n/types'
import { remarkNoExecutableContent } from '@/lib/mdx-security'

/**
 * Drop the document's leading h1 — positional, first node only. For pages that
 * render their own <Hero title> above verbatim upstream markdown (privacy,
 * terms) whose body opens with `# Title`; the mirror is read-only, so the
 * duplicate has to go at render time. Deliberately NOT a blanket h1 strip:
 * legal bodies use `##` for sections, and an h1 further down would be an
 * authoring signal we want to see, not silently swallow.
 */
// Minimal structural mdast shape — 'mdast' types aren't a direct dependency.
interface MdastRoot {
    children: Array<{ type: string; depth?: number }>
}

function remarkStripLeadingH1() {
    return (tree: MdastRoot) => {
        const first = tree.children[0]
        if (first?.type === 'heading' && first.depth === 1) {
            tree.children.shift()
        }
    }
}

/**
 * Compile markdown/MDX content into a React element with registered components.
 * Uses next-mdx-remote/rsc for server-side rendering (zero client JS).
 *
 * Note: frontmatter is already stripped by content.ts (gray-matter).
 * The source passed here is body-only — no parseFrontmatter needed.
 *
 * format: 'mdx' — enables JSX component tags in content.
 * remarkGfm — enables GFM tables, strikethrough, autolinks, etc.
 *
 * Limitation: next-mdx-remote/rsc strips JSX expression props ({...}).
 * Components that need structured data accept JSON strings instead.
 *
 * remarkNoExecutableContent — content is published to production without human
 * review, so it must not be able to execute. See mdx-security.ts.
 */
export async function renderContent(
    source: string,
    locale: Locale = DEFAULT_LOCALE,
    options?: { stripLeadingH1?: boolean }
) {
    return compileMDX<Record<string, unknown>>({
        source,
        components: createMdxComponents(locale),
        options: {
            mdxOptions: {
                format: 'mdx',
                remarkPlugins: [
                    remarkNoExecutableContent,
                    remarkGfm,
                    ...(options?.stripLeadingH1 ? [remarkStripLeadingH1] : []),
                ],
            },
        },
    })
}
