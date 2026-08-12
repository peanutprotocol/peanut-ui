import type { LandingStrings } from './landingStrings'

// White on the blue beat is 2.33:1, so the headline is ringed in black on every
// side instead of carrying a two-sided drop shadow. The ring closes the gap
// between lines at 0.95 leading, hence the looser leading on small screens.
const HEADLINE_RING = '3px 3px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000'

export function Manifesto({ strings }: { strings: LandingStrings }) {
    const { manifesto } = strings

    return (
        <section id="manifesto" className="relative overflow-hidden bg-secondary-3 px-4 py-18 text-n-1 md:py-28">
            <div className="mx-auto max-w-5xl">
                <h2
                    className="font-roboto-flex-extrabold text-[2rem] font-extraBlack leading-[1.02] tracking-tight text-white md:text-[3.75rem] md:leading-[0.95]"
                    style={{ textShadow: HEADLINE_RING }}
                >
                    {manifesto.heading}
                </h2>
                <p className="font-roboto-flex mt-6 text-xl font-bold md:text-2xl">{manifesto.subline}</p>
            </div>
        </section>
    )
}
