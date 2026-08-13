import Link from 'next/link'
import { Button } from '@/components/0_Bruddle/Button'
import { Sparkle } from './Sparkle'
import type { LandingStrings } from './landingStrings'

// On the black beat a black shadow vanishes, so the door button carries a pink
// one — the border stays black, like every other button on the page. Arbitrary
// rather than shadow-4 because no pink shadow token exists. It is the button's
// only shadow: passing shadowSize as well would stack two of them.
const DOOR_SHADOW = 'shadow-[4px_4px_0_#FF90E8]'

export function NotForYou({ strings }: { strings: LandingStrings }) {
    const { notForYou } = strings

    return (
        <section
            id="not-for-you"
            data-own-cta
            className="relative overflow-hidden bg-n-1 px-4 py-18 text-white md:py-28"
        >
            <div className="mx-auto max-w-6xl">
                <h2 className="font-roboto-flex-extrabold text-5xl font-extraBlack uppercase tracking-tight md:text-headingMedium">
                    {notForYou.heading}
                </h2>
                <p className="font-roboto-flex mt-6.5 max-w-[40ch] text-xl leading-snug opacity-90 md:text-2xl">
                    {notForYou.body}
                </p>

                <div className="mt-11 flex flex-col items-start gap-4.5">
                    <Link href="/shhhhh">
                        <Button
                            className={`!w-auto bg-white px-7 py-3 text-base font-extrabold hover:bg-white/90 md:px-9 md:text-lg ${DOOR_SHADOW}`}
                        >
                            {strings.tryTheDoor}
                        </Button>
                    </Link>
                    <Link
                        href="/setup"
                        className="font-roboto-flex text-sm font-extrabold text-white underline underline-offset-4"
                    >
                        {notForYou.signUpLink}
                    </Link>
                </div>

                <div className="mt-8 flex gap-2.5 opacity-85">
                    <Sparkle filled />
                    <Sparkle filled={false} />
                </div>
            </div>
        </section>
    )
}
