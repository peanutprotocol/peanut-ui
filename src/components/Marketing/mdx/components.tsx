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
import { Tabs, TabPanel } from './Tabs'
import { PROSE_WIDTH } from './constants'

/**
 * Component map for MDX content rendering.
 * These components are available in .md/.mdx files without imports.
 *
 * Prose column: PROSE_WIDTH (~Wise's 600px content width)
 * Text color: text-grey-1 (#5F646D) for body, text-n-1 for headings
 * Line-height: leading-[1.75] for generous readability
 * Paragraph spacing: mb-6 (24px) matching Wise
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const mdxComponents: Record<string, React.ComponentType<any>> = {
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
            className={`mx-auto mb-5 mt-10 ${PROSE_WIDTH} px-6 text-2xl font-extrabold text-n-1 md:mt-12 md:px-4 md:text-3xl`}
            {...props}
        />
    ),
    h2: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
        <div className="relative">
            <ProseStars />
            <h2
                className={`mx-auto mb-5 mt-14 ${PROSE_WIDTH} px-6 text-2xl font-extrabold text-n-1 md:mt-16 md:px-4 md:text-3xl`}
                {...props}
            />
        </div>
    ),
    h3: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
        <h3
            className={`mx-auto mb-3 mt-10 ${PROSE_WIDTH} px-6 text-xl font-bold text-n-1 md:px-4 md:text-2xl`}
            {...props}
        />
    ),
    p: (props: React.HTMLAttributes<HTMLParagraphElement>) => (
        <p className={`mx-auto mb-6 ${PROSE_WIDTH} px-6 text-base leading-[1.75] text-grey-1 md:px-4`} {...props} />
    ),
    a: ({ href = '', ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
        <Link
            href={href}
            className="text-n-1 underline decoration-n-1/30 underline-offset-2 hover:decoration-n-1"
            {...props}
        />
    ),
    ul: (props: React.HTMLAttributes<HTMLUListElement>) => (
        <ul className={`mx-auto my-5 ${PROSE_WIDTH} list-disc space-y-3 pl-12 pr-6 md:pl-10 md:pr-4`} {...props} />
    ),
    ol: (props: React.HTMLAttributes<HTMLOListElement>) => (
        <ol className={`mx-auto my-5 ${PROSE_WIDTH} list-decimal space-y-3 pl-12 pr-6 md:pl-10 md:pr-4`} {...props} />
    ),
    li: (props: React.HTMLAttributes<HTMLLIElement>) => (
        <li className="text-base leading-[1.75] text-grey-1" {...props} />
    ),
    strong: (props: React.HTMLAttributes<HTMLElement>) => <strong className="font-semibold text-n-1" {...props} />,
    table: (props: React.HTMLAttributes<HTMLTableElement>) => (
        <div className={`mx-auto my-8 ${PROSE_WIDTH} overflow-x-auto px-6 md:px-4`}>
            <div className="overflow-hidden rounded-sm border border-n-1">
                <table className="w-full border-collapse text-left text-sm" {...props} />
            </div>
        </div>
    ),
    th: (props: React.HTMLAttributes<HTMLTableCellElement>) => (
        <th
            className="border-b border-n-1 bg-primary-1/15 px-4 py-3 text-xs font-bold uppercase tracking-wide text-n-1"
            {...props}
        />
    ),
    td: (props: React.HTMLAttributes<HTMLTableCellElement>) => (
        <td className="border-b border-n-1/10 px-4 py-3 text-grey-1" {...props} />
    ),
    blockquote: (props: React.HTMLAttributes<HTMLQuoteElement>) => (
        <blockquote
            className={`mx-auto my-8 ${PROSE_WIDTH} border-l-4 border-primary-1 py-1 pl-6 pr-6 md:pr-4`}
            {...props}
        />
    ),
    hr: (props: React.HTMLAttributes<HTMLHRElement>) => (
        <hr className={`mx-auto my-12 ${PROSE_WIDTH} border-n-1/10`} {...props} />
    ),
}
