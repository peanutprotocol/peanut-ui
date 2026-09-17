import Link from 'next/link'
import { Hero } from './Hero'
import { Steps, Step } from './Steps'
import { FAQ, FAQItem } from './FAQ'
import { CTA } from './CTA'
import { Callout } from './Callout'
import { ExchangeWidget } from './ExchangeWidget'
import { RelatedPages, RelatedLink } from './RelatedPages'
import { CountryGrid } from './CountryGrid'
import { ProseStars } from './ProseStars'
import { extractText } from './mdx.utils'
import { Tabs, TabPanel } from './Tabs'
import Divider from '@/components/0_Bruddle/Divider'
import { PROSE_WIDTH } from '../constants'
import { DEFAULT_LOCALE, type Locale } from '@/i18n/types'
import { resolveContentHref } from '@/lib/content'

/**
 * Component map for MDX content rendering.
 * These components are available in .md/.mdx files without imports.
 *
 * Prose column: PROSE_WIDTH (~Wise's 600px content width)
 * Text color: text-foreground-secondary (#5F646D) for body, text-foreground-primary for headings
 * Line-height: leading-[1.75] for generous readability
 * Paragraph spacing: mb-6 (24px) matching Wise
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MdxComponentMap = Record<string, React.ComponentType<any>>

/**
 * Locale is injected here rather than authored in MDX: content files are
 * locale-agnostic (one file per locale, same component tags), so any component
 * that builds links or copy has to be bound to the page's locale or it silently
 * falls back to English.
 */
export function createMdxComponents(locale: Locale = DEFAULT_LOCALE): MdxComponentMap {
    return {
        ...mdxComponents,
        CountryGrid: (props) => <CountryGrid {...props} locale={locale} />,
        Steps: (props) => <Steps {...props} locale={locale} />,
        RelatedPages: (props) => <RelatedPages {...props} locale={locale} />,
        FAQ: (props) => <FAQ {...props} locale={locale} />,
        Callout: (props) => <Callout {...props} locale={locale} />,
        // Markdown links are authored with mixed locale prefixes (`/en/help/x`,
        // `/help/x`), so a Spanish page would otherwise link back to English.
        a: ({ href = '', ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
            <Link
                href={resolveContentHref(href, locale)}
                className="text-foreground-primary underline decoration-foreground-primary/30 underline-offset-2 hover:decoration-foreground-primary"
                {...props}
            />
        ),
    }
}

export const mdxComponents: MdxComponentMap = {
    // Custom components
    Hero,
    Steps,
    Step,
    FAQ,
    FAQItem,
    CTA,
    Callout,
    ExchangeWidget,
    RelatedPages,
    RelatedLink,
    CountryGrid,
    Tabs,
    TabPanel,

    // Element overrides — prose styling
    h1: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
        <h1
            className={`mx-auto mt-10 mb-4 ${PROSE_WIDTH} px-6 text-heading-s text-foreground-primary md:mt-12 md:px-4 md:text-heading-m`}
            {...props}
        />
    ),
    h2: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
        <div className="relative">
            <ProseStars seed={extractText(props.children)} />
            <h2
                className={`mx-auto mt-14 mb-4 ${PROSE_WIDTH} px-6 text-heading-s text-foreground-primary md:mt-16 md:px-4 md:text-heading-m`}
                {...props}
            />
        </div>
    ),
    h3: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
        <h3
            className={`mx-auto mt-10 mb-3 ${PROSE_WIDTH} px-6 text-heading-xs text-foreground-primary md:px-4 md:text-heading-s`}
            {...props}
        />
    ),
    p: (props: React.HTMLAttributes<HTMLParagraphElement>) => (
        <p
            className={`mx-auto mb-6 ${PROSE_WIDTH} px-6 text-body-m leading-7 text-foreground-secondary md:px-4`}
            {...props}
        />
    ),
    a: ({ href = '', ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
        <Link
            href={href}
            className="text-foreground-primary underline decoration-foreground-primary/30 underline-offset-2 hover:decoration-foreground-primary"
            {...props}
        />
    ),
    ul: (props: React.HTMLAttributes<HTMLUListElement>) => (
        <ul className={`mx-auto my-6 ${PROSE_WIDTH} space-y-3 list-disc pr-6 pl-12 md:pr-4 md:pl-10`} {...props} />
    ),
    ol: (props: React.HTMLAttributes<HTMLOListElement>) => (
        <ol className={`mx-auto my-6 ${PROSE_WIDTH} space-y-3 list-decimal pr-6 pl-12 md:pr-4 md:pl-10`} {...props} />
    ),
    li: (props: React.HTMLAttributes<HTMLLIElement>) => (
        <li className="text-body-m leading-7 text-foreground-secondary" {...props} />
    ),
    strong: (props: React.HTMLAttributes<HTMLElement>) => (
        <strong className="font-semibold text-foreground-primary" {...props} />
    ),
    table: (props: React.HTMLAttributes<HTMLTableElement>) => (
        <div className={`mx-auto my-8 ${PROSE_WIDTH} overflow-x-auto px-6 md:px-4`}>
            {/* x-auto, not hidden: a table wider than the phone must scroll
                inside the border, never clip its columns (TASK-22366) */}
            <div className="overflow-x-auto rounded-sm border border-border-default">
                <table className="w-full border-collapse text-left text-body-s" {...props} />
            </div>
        </div>
    ),
    th: (props: React.HTMLAttributes<HTMLTableCellElement>) => (
        <th
            className="border-b border-border-default bg-action-primary/15 px-4 py-3 text-label-m tracking-wide text-foreground-primary uppercase"
            {...props}
        />
    ),
    td: (props: React.HTMLAttributes<HTMLTableCellElement>) => (
        <td className="border-b border-border-default/10 px-4 py-3 text-foreground-secondary" {...props} />
    ),
    blockquote: (props: React.HTMLAttributes<HTMLQuoteElement>) => (
        <blockquote
            className={`mx-auto my-8 ${PROSE_WIDTH} border-l-4 border-action-primary py-1 pr-6 pl-6 md:pr-4`}
            {...props}
        />
    ),
    // Divider, not <hr>: the rule's weight and color belong to the component.
    // It takes no label here — a labelled one ships at text-body-xs via
    // textClassname, one step below the component's own text-body-s default.
    hr: () => (
        <div className={`mx-auto my-12 ${PROSE_WIDTH}`}>
            <Divider />
        </div>
    ),
}
