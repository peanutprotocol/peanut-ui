'use client'

import type { ReactNode } from 'react'
import { Icon } from '@/components/Global/Icons/Icon'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { CARD_SURFACE } from '@/components/0_Bruddle/Card'

export type FAQsProps = {
    heading: string
    /** Translated label for the per-question "learn more" link. Without it the
     *  link is not rendered — there is no English fallback to leak. */
    learnMoreLabel?: string
    questions: Array<{
        id: string
        question: string
        answer: string
        /** Rich JSX answer body — rendered instead of `answer`, which still feeds SEO schemas */
        answerContent?: ReactNode
        redirectUrl?: string
        redirectText?: string
        calModal?: boolean
        /** Article that answers this question in full. Renders a "learn more" link under the answer. */
        learnMoreHref?: string
    }>
    /** 'band' (default): full-width cream band. 'card': a white card on the
     *  page's own ground, used by marketing pages. */
    variant?: 'band' | 'card'
}

function linkifyText(text: string) {
    const markdownLinkRegex = /\[([^\]]+)\]\(([^\s)]+)\)/g
    const parts: (string | JSX.Element)[] = []
    let lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = markdownLinkRegex.exec(text)) !== null) {
        if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index))
        const isExternal = match[2].startsWith('http')
        parts.push(
            <a
                key={match.index}
                href={match[2]}
                {...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                className="text-foreground-primary underline hover:text-action-ghost-hover"
            >
                {match[1]}
            </a>
        )
        lastIndex = match.index + match[0].length
    }
    if (lastIndex < text.length) parts.push(text.slice(lastIndex))
    return parts
}

export function FAQsPanel({ heading, questions, learnMoreLabel, variant = 'band' }: FAQsProps) {
    const isCard = variant === 'card'
    return (
        // drift fix: was near-miss hex — snapped to the page-background token
        <section
            className={
                isCard
                    ? 'relative overflow-hidden px-4 py-12 text-foreground-primary'
                    : 'relative overflow-hidden bg-background-page px-4 py-24 text-foreground-primary md:py-32'
            }
        >
            <div className={isCard ? `mx-auto max-w-3xl ${CARD_SURFACE} p-6 md:p-10` : 'mx-auto max-w-3xl'}>
                {/* headingSmall on mobile: "PERGUNTAS FREQUENTES" at text-heading
                    (60px) needs 401px and clips at 320px (TASK-22366) */}
                <h2 className="font-roboto-flex-extrabold text-headingSmall font-extraBlack uppercase md:text-headingMedium">
                    {heading}
                </h2>
                {/* the card's own border frames the list, so no outer rules there */}
                <div className={isCard ? 'mt-10' : 'mt-10 border-y-2 border-border-default'}>
                    {questions.map((faq, idx) => (
                        <details
                            key={faq.id}
                            className={`group py-4 ${idx > 0 ? 'border-t-2 border-border-default' : ''}`}
                        >
                            {/* native details/summary, deliberately not the DS
                                Accordion: radix unmounts closed content, and
                                these answers must stay in the server HTML for
                                search on ~700 pages. */}
                            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-sm text-heading-card uppercase focus-visible:outline-[3px] focus-visible:outline-action-focus focus-visible:outline-solid md:text-heading-xs [&::-webkit-details-marker]:hidden">
                                <span>{faq.question}</span>
                                <Icon
                                    name="plus"
                                    size={20}
                                    className="shrink-0 transition-transform duration-fast group-open:rotate-45"
                                />
                            </summary>
                            <div className="mt-4 text-body-l text-foreground-primary">
                                {faq.answerContent ?? <p className="whitespace-pre-line">{linkifyText(faq.answer)}</p>}
                                {/* english-only label, and latent: nothing sets calModal
                                    today. cal.com binds [data-cal-link] on any element,
                                    so a button keeps the behaviour and is keyboard
                                    reachable — the hrefless anchor was neither focusable
                                    nor exposed as a link. */}
                                {faq.calModal && (
                                    <button
                                        type="button"
                                        data-cal-link="kkonrad+hugo0/15min?duration=30"
                                        data-cal-config='{"layout":"month_view"}'
                                        className="cursor-pointer underline"
                                    >
                                        Let&apos;s talk!
                                    </button>
                                )}
                                {faq.redirectUrl && faq.redirectText && (
                                    <a
                                        href={faq.redirectUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-foreground-primary underline"
                                    >
                                        {faq.redirectText}
                                    </a>
                                )}
                                {faq.learnMoreHref && learnMoreLabel && (
                                    <p className="mt-4 text-right">
                                        <LinkButton href={faq.learnMoreHref} icon>
                                            {learnMoreLabel}
                                        </LinkButton>
                                    </p>
                                )}
                            </div>
                        </details>
                    ))}
                </div>
            </div>
        </section>
    )
}
