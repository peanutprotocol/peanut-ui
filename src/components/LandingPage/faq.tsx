'use client'

import { useCallback, useState } from 'react'
import { Eyes } from '@/assets'
import { MarqueeComp } from '@/components/Global/MarqueeWrapper'

export type FAQQuestion = {
    id: string
    question: string
    answer: string
    redirectUrl?: string
    redirectText?: string
}

type FAQsProps = {
    heading: string
    questions: FAQQuestion[]
    marquee?: {
        visible: boolean
        message?: string
    }
}

function linkifyText(text: string) {
    const markdownLinkRegex = /\[([^\]]+)\]\(([^\s)]+)\)/g
    const parts: (string | JSX.Element)[] = []
    let lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = markdownLinkRegex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            parts.push(text.slice(lastIndex, match.index))
        }
        const isExternal = match[2].startsWith('http')
        parts.push(
            <a
                key={match.index}
                href={match[2]}
                {...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                className="text-black underline"
            >
                {match[1]}
            </a>
        )
        lastIndex = match.index + match[0].length
    }

    if (lastIndex < text.length) {
        parts.push(text.slice(lastIndex))
    }

    return parts
}

export function FAQs({ heading, questions, marquee = { visible: false } }: FAQsProps) {
    const [openId, setOpenId] = useState<string | null>(questions[0]?.id ?? null)

    const toggle = useCallback((id: string) => {
        setOpenId((prev) => (prev === id ? null : id))
    }, [])

    return (
        <div id="faq" className="overflow-x-hidden bg-[#F9F4F0]">
            <div className="px-6 py-24 md:px-8 md:py-32">
                <h2 className="mb-12 text-center text-5xl font-black leading-[0.9] tracking-[-0.035em] md:mb-14 md:text-7xl">
                    {heading}
                </h2>

                <div className="mx-auto max-w-[780px]">
                    {questions.map((faq) => {
                        const isOpen = openId === faq.id
                        return (
                            <div
                                key={faq.id}
                                className="mb-3.5 overflow-hidden rounded-sm border-2 border-n-1 bg-white shadow-[4px_4px_0_#000]"
                            >
                                <button
                                    type="button"
                                    onClick={() => toggle(faq.id)}
                                    aria-expanded={isOpen}
                                    aria-controls={`faq-answer-${faq.id}`}
                                    className="flex w-full cursor-pointer items-center justify-between gap-4 px-6 py-5 text-left text-lg font-black md:px-7 md:py-6"
                                >
                                    <span className="grow leading-tight">{faq.question}</span>
                                    <span className="shrink-0 text-3xl font-black leading-none">
                                        {isOpen ? '–' : '+'}
                                    </span>
                                </button>
                                {isOpen && (
                                    <div
                                        id={`faq-answer-${faq.id}`}
                                        className="px-6 pb-5 text-[15px] leading-relaxed text-n-1 md:px-7 md:pb-6"
                                    >
                                        <p className="whitespace-pre-line">{linkifyText(faq.answer)}</p>
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
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>

            {marquee.visible && (
                <MarqueeComp
                    message={marquee.message}
                    imageSrc={Eyes.src}
                    imageAnimationClass="animation-rock"
                    backgroundColor="bg-secondary-1"
                />
            )}
        </div>
    )
}
