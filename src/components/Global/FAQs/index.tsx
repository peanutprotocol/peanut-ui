'use client'

import type { ReactNode } from 'react'

export type FAQsProps = {
    heading: string
    questions: Array<{
        id: string
        question: string
        answer: string
        /** Rich JSX answer body — rendered instead of `answer`, which still feeds SEO schemas */
        answerContent?: ReactNode
        redirectUrl?: string
        redirectText?: string
        calModal?: boolean
    }>
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
                className="text-black underline hover:text-accent"
            >
                {match[1]}
            </a>
        )
        lastIndex = match.index + match[0].length
    }
    if (lastIndex < text.length) parts.push(text.slice(lastIndex))
    return parts
}

export function FAQsPanel({ heading, questions }: FAQsProps) {
    return (
        <section className="relative overflow-hidden bg-[#F9F4F0] px-4 py-24 text-n-1 md:py-32">
            <div className="mx-auto max-w-3xl">
                <h2 className="font-roboto-flex-extrabold text-heading font-extraBlack uppercase md:text-headingMedium">
                    {heading}
                </h2>
                <div className="mt-10 border-y-2 border-n-1">
                    {questions.map((faq, idx) => (
                        <details key={faq.id} className={`group py-5 ${idx > 0 ? 'border-t-2 border-n-1' : ''}`}>
                            <summary className="font-roboto-flex-extrabold flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-extraBlack uppercase md:text-xl [&::-webkit-details-marker]:hidden">
                                <span>{faq.question}</span>
                                <span className="shrink-0 text-3xl leading-none transition-transform duration-200 group-open:rotate-45">
                                    +
                                </span>
                            </summary>
                            <div className="mt-4 text-lg font-semibold leading-6 text-n-1 md:text-xl">
                                {faq.answerContent ?? <p className="whitespace-pre-line">{linkifyText(faq.answer)}</p>}
                                {faq.calModal && (
                                    <a
                                        data-cal-link="kkonrad+hugo0/15min?duration=30"
                                        data-cal-config='{"layout":"month_view"}'
                                        className="underline"
                                    >
                                        Let&apos;s talk!
                                    </a>
                                )}
                                {faq.redirectUrl && faq.redirectText && (
                                    <a
                                        href={faq.redirectUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-black underline"
                                    >
                                        {faq.redirectText}
                                    </a>
                                )}
                            </div>
                        </details>
                    ))}
                </div>
            </div>
        </section>
    )
}
