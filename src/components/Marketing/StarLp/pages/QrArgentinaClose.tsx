import { Band } from '@/components/Marketing/StarLp/Band'
import { KnerdTitle } from '@/components/Marketing/StarLp/KnerdTitle'
import { StarLpCta } from '@/components/Marketing/StarLp/StarLpCta'
import { STAR_LP_HREF } from '@/components/Marketing/StarLp/starLp.consts'
import { QrArgentinaScanFrame } from './QrArgentinaScanFrame'
import { QrArgentinaSticker } from './QrArgentinaSticker'

/**
 * The closing fold. CloseFold only takes side decorations, and this mock puts
 * the sticker in a scanner frame between the title and the line, so the fold
 * is composed from the same primitives in CloseFold's order and spacing.
 * The sticker holds still so its code scans; the frame carries the motion.
 */
export function QrArgentinaClose() {
    return (
        <Band ground="pink" align="center">
            <h2>
                <KnerdTitle text="Scan it" size="hero" />
            </h2>
            <QrArgentinaScanFrame>
                <QrArgentinaSticker slot="close-sticker" />
            </QrArgentinaScanFrame>
            {/* The code is the page's install link dressed as the till's sticker, so the
                caption says which is which: without it the fold reads as a code to pay. */}
            <p className="mx-auto mt-4 max-w-xs text-body-s text-balance">
                The sticker you&apos;ll see at the till. Scan this one to get the app.
            </p>
            <p className="mx-auto mt-8 max-w-xl text-body-l">Verify with your passport before you land.</p>
            <div className="mx-auto mt-8 w-fit">
                <StarLpCta href={STAR_LP_HREF.signup} ground="pink">
                    Create an account
                </StarLpCta>
            </div>
        </Band>
    )
}
