import type { LandingStrings } from './landingStrings'

const bgColor = '#F9F4F0'

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
            icon: (
                <>
                    <circle cx="22" cy="22" r="19" fill="none" stroke="#000" strokeWidth="3" />
                    <circle cx="22" cy="22" r="13" fill="none" stroke="#000" strokeWidth="2" strokeDasharray="4 4" />
                    <path
                        d="M22 13l2.4 6.2 6.6.4-5.1 4.2 1.7 6.4L22 26.7l-5.6 3.5 1.7-6.4-5.1-4.2 6.6-.4z"
                        fill="#000"
                    />
                </>
            ),
        },
        {
            id: 'send-home',
            title: problem.sendHomeTitle,
            body: problem.sendHomeBody,
            icon: (
                <>
                    <circle cx="13" cy="13" r="7" fill="none" stroke="#000" strokeWidth="3.4" />
                    <circle cx="31" cy="31" r="7" fill="none" stroke="#000" strokeWidth="3.4" />
                    <path d="M34 8L10 36" stroke="#000" strokeWidth="3.4" strokeLinecap="round" />
                </>
            ),
        },
        {
            id: 'paid-abroad',
            title: problem.paidAbroadTitle,
            body: problem.paidAbroadBody,
            icon: (
                <>
                    <path
                        d="M4 15h28m-7-7 7 7-7 7"
                        fill="none"
                        stroke="#000"
                        strokeWidth="3.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                    <path
                        d="M40 29H12m7-7-7 7 7 7"
                        fill="none"
                        stroke="#000"
                        strokeWidth="3.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </>
            ),
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
                            <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden>
                                {card.icon}
                            </svg>
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
