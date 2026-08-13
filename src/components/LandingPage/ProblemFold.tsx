import Image from 'next/image'
import HandThumbsUp from '@/assets/illustrations/hand-thumbs-up.svg'
import NoHiddenFeesHand from '@/assets/illustrations/no-hidden-fees-hand.svg'
import type { LandingStrings } from './landingStrings'

const bgColor = '#F9F4F0'

// One height for all three marks so the card tops line up. The glyph needs a
// bigger type size than the drawings to reach the same optical weight — a
// Knerd "%" only fills about two thirds of its em box.
const iconClass = 'h-11 w-auto'

// Card tilts, in source order. Small and alternating, so the row reads as
// hand-placed rather than as a broken grid.
const tilts = ['-rotate-1', 'rotate-[0.8deg]', '-rotate-[0.6deg]']

/**
 * "You already know the problem." — three named cards, one per person we built
 * peanut for. No links: this fold names the pain, the folds under it answer it.
 */
export function ProblemFold({ strings }: { strings: LandingStrings }) {
    const { problem } = strings

    const cards = [
        {
            id: 'cross-border',
            title: problem.crossBorderTitle,
            body: problem.crossBorderBody,
            // the marquee's thumbs-up, turned over: the verification verdict
            icon: <Image src={HandThumbsUp} alt="" aria-hidden className={`${iconClass} rotate-180`} />,
        },
        {
            id: 'send-home',
            title: problem.sendHomeTitle,
            body: problem.sendHomeBody,
            icon: (
                <span aria-hidden className="h-11 font-knerd-outline text-[3.9rem] leading-[2.75rem]">
                    %
                </span>
            ),
        },
        {
            id: 'paid-abroad',
            title: problem.paidAbroadTitle,
            body: problem.paidAbroadBody,
            // the pinch hand from the no-hidden-fees art
            icon: <Image src={NoHiddenFeesHand} alt="" aria-hidden className={iconClass} />,
        },
    ]

    return (
        <section
            id="the-problem"
            className="relative overflow-hidden px-4 py-20 text-n-1 md:py-28"
            style={{ backgroundColor: bgColor }}
        >
            <div className="mx-auto max-w-6xl">
                <h2 className="font-roboto-flex-extrabold text-4xl font-extraBlack uppercase leading-none md:text-6xl lg:text-heading">
                    {problem.heading}
                </h2>

                <div className="mt-9 grid grid-cols-1 gap-4.5 md:grid-cols-3 md:gap-6">
                    {cards.map((card, i) => (
                        <div
                            key={card.id}
                            className={`shadow-4 rounded-sm border-2 border-n-1 bg-white px-5 py-6 md:px-7 md:py-7 ${tilts[i]}`}
                        >
                            <div className="flex h-11 items-center">{card.icon}</div>
                            <h3 className="font-roboto-flex-extrabold mt-4 text-xl font-extraBlack uppercase leading-tight md:text-2xl">
                                {card.title}
                            </h3>
                            <p className="font-roboto-flex mt-2.5 text-lg leading-relaxed">{card.body}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}
