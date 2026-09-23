import Link from 'next/link'
import { Hero } from './Hero'
import { Steps, Step } from './Steps'
import { FAQ, FAQItem } from './FAQ'
import { CTA } from './CTA'
import { Callout } from './Callout'
import { ExchangeWidget } from './ExchangeWidget'
import { CompareSavings } from './CompareSavings'
import { RelatedPages, RelatedLink } from './RelatedPages'
import { CountryGrid } from './CountryGrid'
import { ProseStars } from './ProseStars'
import { extractText } from './mdx.utils'
import { Tabs, TabPanel } from './Tabs'
import Divider from '@/components/0_Bruddle/Divider'
import { PROSE_LINK, PROSE_WIDTH } from '../constants'
import { getTranslations } from '@/i18n'
import { DEFAULT_LOCALE, type Locale } from '@/i18n/types'
import { resolveContentHref } from '@/lib/content'
import { exchangeWidgetLabels } from '@/components/LandingPage/landingStrings'

/**
 * Component map for MDX content rendering.
 * These components are available in .md/.mdx files without imports.
 *
 * Prose column: PROSE_WIDTH (~Wise's 600px content width)
 * Text: text-body-m / leading-7 in text-foreground-secondary, headings in
 * text-foreground-primary. Paragraph spacing mb-6.
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
    const i18n = getTranslations(locale)
    return {
        ...mdxComponents,
        CountryGrid: (props) => <CountryGrid {...props} locale={locale} />,
        // CompareSavings is a client component, so its copy is picked here key
        // by key: passing the whole catalog would serialize ~14 KB of unused
        // strings into every compare page.
        CompareSavings: (props) => (
            <CompareSavings
                {...props}
                locale={locale}
                strings={{
                    compareSavingsLive: i18n.compareSavingsLive,
                    compareSavingsStatic: i18n.compareSavingsStatic,
                    compareSavingsUnverified: i18n.compareSavingsUnverified,
                    compareSavingsSource: i18n.compareSavingsSource,
                }}
            />
        ),
        // Same catalog keys the landing page hands its widget — the embed is a
        // client component, so only the widget's own labels cross over.
        ExchangeWidget: (props) => <ExchangeWidget {...props} labels={exchangeWidgetLabels(i18n)} />,
        Steps: (props) => <Steps {...props} locale={locale} />,
        RelatedPages: (props) => <RelatedPages {...props} locale={locale} />,
        FAQ: (props) => <FAQ {...props} locale={locale} />,
        Callout: (props) => <Callout {...props} locale={locale} />,
        // Markdown links are authored with mixed locale prefixes (`/en/help/x`,
        // `/help/x`), so a Spanish page would otherwise link back to English.
        a: ({ href = '', ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
            <Link href={resolveContentHref(href, locale)} className={PROSE_LINK} {...props} />
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
    CompareSavings,
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
        // overflow-x-clip: the stars sit partly past the viewport by design,
        // and nothing else clips them — without this the page scrolls
        // sideways at 375px. clip keeps overflow-y visible, so the -top
        // offsets still show.
        <div className="relative overflow-x-clip">
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
    h4: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
        <h4
            className={`mx-auto mt-8 mb-2 ${PROSE_WIDTH} px-6 text-heading-card text-foreground-primary md:px-4 md:text-heading-xs`}
            {...props}
        />
    ),
    // h5/h6 share one size: the heading ramp bottoms out at heading-card, and
    // content this deep is a labelled paragraph, not a heading step.
    h5: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
        <h5
            className={`mx-auto mt-6 mb-2 ${PROSE_WIDTH} px-6 text-body-m-semibold text-foreground-primary md:px-4`}
            {...props}
        />
    ),
    h6: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
        <h6
            className={`mx-auto mt-6 mb-2 ${PROSE_WIDTH} px-6 text-body-m-semibold text-foreground-primary md:px-4`}
            {...props}
        />
    ),
    p: (props: React.HTMLAttributes<HTMLParagraphElement>) => (
        <p
            className={`mx-auto mb-6 ${PROSE_WIDTH} px-6 text-body-m leading-7 break-words text-foreground-secondary md:px-4`}
            {...props}
        />
    ),
    a: ({ href = '', ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
        <Link href={href} className={PROSE_LINK} {...props} />
    ),
    ul: (props: React.HTMLAttributes<HTMLUListElement>) => (
        <ul className={`mx-auto my-6 ${PROSE_WIDTH} space-y-3 list-disc pr-6 pl-12 md:pr-4 md:pl-10`} {...props} />
    ),
    ol: (props: React.HTMLAttributes<HTMLOListElement>) => (
        <ol className={`mx-auto my-6 ${PROSE_WIDTH} space-y-3 list-decimal pr-6 pl-12 md:pr-4 md:pl-10`} {...props} />
    ),
    li: (props: React.HTMLAttributes<HTMLLIElement>) => (
        <li className="text-body-m leading-7 break-words text-foreground-secondary" {...props} />
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
    pre: (props: React.HTMLAttributes<HTMLPreElement>) => (
        <div className={`mx-auto my-6 ${PROSE_WIDTH} px-6 md:px-4`}>
            {/* x-auto on the pre itself, same reason as the table above: a long
                code line scrolls inside the block, it never widens the page
                (TASK-22366). Nested <code> drops its own background so the two
                /10 layers don't stack into a darker stripe. */}
            <pre
                className="overflow-x-auto rounded-sm bg-foreground-primary/10 p-4 font-mono text-body-s text-foreground-primary [&_code]:bg-transparent [&_code]:p-0"
                {...props}
            />
        </div>
    ),
    code: (props: React.HTMLAttributes<HTMLElement>) => (
        <code className="rounded-sm bg-foreground-primary/10 px-1 font-mono" {...props} />
    ),
    // Plain <img>: MDX authors ship no width/height, which next/image requires.
    // The parent <p> already carries the prose column, so no wrapper (a div
    // inside a <p> would break hydration).
    img: ({ alt = '', ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="mx-auto my-6 block h-auto max-w-full" alt={alt} {...props} />
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
