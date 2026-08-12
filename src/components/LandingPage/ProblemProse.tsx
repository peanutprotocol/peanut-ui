import type { LandingStrings } from './landingStrings'

const POINTER_TARGET = '#works-today'

export function ProblemProse({ strings }: { strings: LandingStrings }) {
    const { problem } = strings
    const pointers = [problem.pointerPassport, problem.pointerRate, problem.pointerMoneyOut]

    return (
        <section id="problem" className="relative overflow-hidden bg-grey-3 px-4 py-18 text-n-1 md:py-28">
            <div className="mx-auto max-w-6xl">
                <h2 className="font-roboto-flex-extrabold text-4xl font-extraBlack uppercase md:text-heading">
                    {problem.heading}
                </h2>

                <p className="font-roboto-flex-extrabold mt-7 text-[1.75rem] font-extraBlack leading-tight tracking-tight md:text-5xl">
                    {problem.prose}
                </p>

                <div className="mt-8 flex flex-wrap gap-x-7 gap-y-3.5">
                    {pointers.map((pointer) => (
                        <a
                            key={pointer}
                            href={POINTER_TARGET}
                            className="font-roboto-flex text-sm font-extrabold underline underline-offset-4"
                        >
                            {/* The arrow is punctuation, not copy — it stays out of
                                the catalogs so no translator has to carry it. */}
                            <span aria-hidden>→ </span>
                            {pointer}
                        </a>
                    ))}
                </div>
            </div>
        </section>
    )
}
