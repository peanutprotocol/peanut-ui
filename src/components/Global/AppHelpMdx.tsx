import DocsLink from '@/components/Global/DocsLink'
import { createMdxComponents } from '@/components/Marketing/mdx/components'
import type { Locale } from '@/i18n/types'
import type { ReactNode } from 'react'

/** Compact article typography for in-app help drawers, using the public article sources. */
export const createAppHelpMdxComponents = (locale: Locale): ReturnType<typeof createMdxComponents> => ({
    ...createMdxComponents(locale),
    Hero: () => null,
    h1: ({ children }) => <h1 className="mb-4 text-heading-s">{children}</h1>,
    h2: ({ children }) => <h2 className="mt-6 mb-2 text-heading-xs">{children}</h2>,
    h3: ({ children }) => <h3 className="mt-4 mb-2 text-heading-card">{children}</h3>,
    h4: ({ children }) => <h4 className="mt-4 mb-2 text-body-m-semibold">{children}</h4>,
    p: ({ children }) => <p className="mb-4 text-body-s leading-6 text-foreground-secondary">{children}</p>,
    ul: ({ children }) => <ul className="space-y-2 mb-4 list-disc pl-4 text-body-s">{children}</ul>,
    ol: ({ children }) => <ol className="space-y-2 mb-4 list-decimal pl-4 text-body-s">{children}</ol>,
    li: ({ children }) => <li className="pl-1 leading-6">{children}</li>,
    blockquote: ({ children }) => (
        <blockquote className="mb-4 border-l-3 border-border-brand pl-4">{children}</blockquote>
    ),
    table: ({ children }) => (
        <div className="mb-4 overflow-x-auto">
            <table className="w-full min-w-[32rem] border-collapse text-left text-body-xs">{children}</table>
        </div>
    ),
    th: ({ children }) => <th className="border border-border-subtle p-2 align-top">{children}</th>,
    td: ({ children }) => <td className="border border-border-subtle p-2 align-top">{children}</td>,
    a: ({ href = '', children }: { href?: string; children: ReactNode }) =>
        href.startsWith('/') ? (
            <DocsLink href={href} className="underline underline-offset-2">
                {children}
            </DocsLink>
        ) : (
            <a href={href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                {children}
            </a>
        ),
    Steps: ({ title, children }: { title?: string; children: ReactNode }) => (
        <section className="mb-4">
            {title && <h2 className="mt-6 mb-2 text-heading-xs">{title}</h2>}
            <ol className="space-y-3 list-decimal pl-4 text-body-s">{children}</ol>
        </section>
    ),
    Step: ({ title, children }: { title?: string; children: ReactNode }) => (
        <li className="pl-1 leading-6">
            {title && <strong>{title}. </strong>}
            {children}
        </li>
    ),
    Callout: ({ children }: { children: ReactNode }) => (
        <div className="mb-4 rounded-sm bg-background-surface-info p-3 text-body-s">{children}</div>
    ),
    FAQ: ({ children }: { children: ReactNode }) => <section className="space-y-4 mb-4">{children}</section>,
    FAQItem: ({ question, children }: { question?: string; children: ReactNode }) => (
        <div>
            {question && <h3 className="mb-1 text-body-m-semibold">{question}</h3>}
            <div className="text-body-s leading-6">{children}</div>
        </div>
    ),
    // These are marketing navigation and chat prompts, not part of the article.
    CTA: () => null,
    RelatedPages: () => null,
})
