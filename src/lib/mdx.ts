import { compileMDX } from 'next-mdx-remote/rsc'
import remarkGfm from 'remark-gfm'
import { mdxComponents } from '@/components/Marketing/mdx/components'
import { remarkNoExecutableContent } from '@/lib/mdx-security'

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
export async function renderContent(source: string) {
    return compileMDX<Record<string, unknown>>({
        source,
        components: mdxComponents,
        options: {
            mdxOptions: {
                format: 'mdx',
                remarkPlugins: [remarkNoExecutableContent, remarkGfm],
            },
        },
    })
}
