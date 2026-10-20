import { Band } from '@/components/Marketing/StarLp/Band'
import { KnerdTitle } from '@/components/Marketing/StarLp/KnerdTitle'
import { StarLpCta } from '@/components/Marketing/StarLp/StarLpCta'
import { Wiggle } from '@/components/Marketing/StarLp/Wiggle'
import { STAR_LP_HREF } from '@/components/Marketing/StarLp/starLp.consts'
import { QrArgentinaSticker } from './QrArgentinaSticker'

// The four corners of the app's scanner frame, drawn round the sticker.
const CORNERS = [
    'top-0 left-0 border-t-[5px] border-l-[5px] rounded-tl-card',
    'top-0 right-0 border-t-[5px] border-r-[5px] rounded-tr-card',
    'bottom-0 left-0 border-b-[5px] border-l-[5px] rounded-bl-card',
    'bottom-0 right-0 border-b-[5px] border-r-[5px] rounded-br-card',
]

/**
 * The closing fold. CloseFold only takes side decorations, and this mock puts
 * the sticker in a scanner frame between the title and the line, so the fold
 * is composed from the same primitives in CloseFold's order and spacing.
 */
export function QrArgentinaClose() {
    return (
        <Band ground="pink" align="center">
            <h2>
                <KnerdTitle text="Scan it" size="hero" />
            </h2>
            <div className="relative mx-auto mt-10 w-44 p-4 md:w-52">
                {CORNERS.map((corner) => (
                    <span key={corner} aria-hidden className={`absolute size-10 border-border-default ${corner}`} />
                ))}
                <Wiggle kind="wobble" className="block">
                    <QrArgentinaSticker />
                </Wiggle>
            </div>
            <p className="mx-auto mt-8 max-w-xl text-body-l">Verify with your passport before you land.</p>
            <div className="mx-auto mt-8 w-fit">
                <StarLpCta href={STAR_LP_HREF.signup} ground="pink">
                    Create an account
                </StarLpCta>
            </div>
        </Band>
    )
}
