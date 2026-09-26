'use client'

import DocsLink from '@/components/Global/DocsLink'
import AppHelpSupportCTA from '@/components/Global/AppHelpSupportCTA'
import { createElement, Fragment, type ComponentType, type ReactNode } from 'react'
import type { AppHelpNode, AppHelpNodeProps } from './appHelpTypes'

type Props = { children?: ReactNode } & Record<string, unknown>

/** Compact article typography for in-app help drawers, keyed by MDX tag and component name. */
const APP_HELP_COMPONENTS: Record<string, ComponentType<Props>> = {
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
            <table className="w-full border-collapse text-left text-body-xs">{children}</table>
        </div>
    ),
    th: ({ children }) => <th className="border border-border-subtle p-2 align-top">{children}</th>,
    td: ({ children }) => <td className="border border-border-subtle p-2 align-top">{children}</td>,
    // Internal hrefs arrive already resolved for the article's locale (see appHelpArticle.server).
    a: ({ href, children }) =>
        typeof href === 'string' && (href.startsWith('/') || href.startsWith('https://peanut.me/')) ? (
            <DocsLink
                href={href.replace(/^https:\/\/peanut\.me/, '')}
                className="underline underline-offset-2"
                openInDrawer
            >
                {children}
            </DocsLink>
        ) : (
            <a
                href={typeof href === 'string' ? href : undefined}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2"
            >
                {children}
            </a>
        ),
    Steps: ({ title, children }) => (
        <section className="mb-4">
            {typeof title === 'string' && <h2 className="mt-6 mb-2 text-heading-xs">{title}</h2>}
            <ol className="space-y-3 list-decimal pl-4 text-body-s">{children}</ol>
        </section>
    ),
    Step: ({ title, children }) => (
        <li className="pl-1 leading-6">
            {typeof title === 'string' && <strong>{title}. </strong>}
            {children}
        </li>
    ),
    Callout: ({ children }) => (
        <div className="mb-4 rounded-sm bg-background-surface-info p-3 text-body-s">{children}</div>
    ),
    FAQ: ({ children }) => <section className="space-y-4 mb-4">{children}</section>,
    FAQItem: ({ question, children }) => (
        <div>
            {typeof question === 'string' && <h3 className="mb-1 text-body-m-semibold">{question}</h3>}
            <div className="text-body-s leading-6">{children}</div>
        </div>
    ),
    CTA: ({ text, href }) => (href === '#chat' && typeof text === 'string' ? <AppHelpSupportCTA text={text} /> : null),
    // Marketing navigation is not part of the in-app article.
    RelatedPages: () => null,
}

/** Plain markdown tags rendered as-is, with only these attributes. */
const HTML_TAGS = new Set(['h5', 'h6', 'strong', 'em', 'del', 'code', 'pre', 'br', 'hr', 'thead', 'tbody', 'tr', 'sup'])
const HTML_ATTRIBUTES = new Set(['colSpan', 'rowSpan'])

const htmlAttributes = (props: AppHelpNodeProps = {}) =>
    Object.fromEntries(Object.entries(props).filter(([name]) => HTML_ATTRIBUTES.has(name)))

function renderNodes(nodes: AppHelpNode[]): ReactNode[] {
    return nodes.map((node, index) => {
        if (typeof node === 'string') return node
        const children = node.c ? renderNodes(node.c) : undefined
        const Component = APP_HELP_COMPONENTS[node.t]
        if (Component) {
            return (
                <Component key={index} {...node.p}>
                    {children}
                </Component>
            )
        }
        if (HTML_TAGS.has(node.t)) return createElement(node.t, { key: index, ...htmlAttributes(node.p) }, children)
        // An unknown tag or component keeps its text; the drawer renders no markup it does not know.
        return <Fragment key={index}>{children}</Fragment>
    })
}

export default function AppHelpArticleBody({ body }: { body: AppHelpNode[] }) {
    return <>{renderNodes(body)}</>
}
