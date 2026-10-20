import { Band } from '@/components/Marketing/StarLp/Band'
import { DropIn } from '@/components/Marketing/StarLp/DropIn'
import { KnerdTitle } from '@/components/Marketing/StarLp/KnerdTitle'
import { StarLpCta } from '@/components/Marketing/StarLp/StarLpCta'
import { STAR_LP_HREF } from '@/components/Marketing/StarLp/starLp.consts'
import { QrBrazilPixSticker } from './QrBrazilPixSticker'

const CORNER = 'absolute size-10 border-border-default'

/**
 * The closing fold: PIX IT over the counter sticker inside the scanner's
 * frame. Built from CloseFold's parts because CloseFold has no slot for art
 * between the title and the line.
 */
export function QrBrazilClose() {
    return (
        <Band ground="pink" align="center">
            <h2>
                <KnerdTitle text="Pix it" size="hero" />
            </h2>
            <div className="relative mx-auto mt-12 w-44 md:w-52">
                <span
                    aria-hidden
                    className={`${CORNER} -top-5 -left-5 rounded-tl-card border-t-[5px] border-l-[5px]`}
                />
                <span
                    aria-hidden
                    className={`${CORNER} -top-5 -right-5 rounded-tr-card border-t-[5px] border-r-[5px]`}
                />
                <span
                    aria-hidden
                    className={`${CORNER} -bottom-5 -left-5 rounded-bl-card border-b-[5px] border-l-[5px]`}
                />
                <span
                    aria-hidden
                    className={`${CORNER} -right-5 -bottom-5 rounded-br-card border-r-[5px] border-b-[5px]`}
                />
                <DropIn fromTilt={-18} tilt={-5}>
                    <QrBrazilPixSticker />
                </DropIn>
            </div>
            <p className="mx-auto mt-14 max-w-xl text-body-l">Verify with your passport before you land.</p>
            <div className="mx-auto mt-8 w-fit">
                <StarLpCta href={STAR_LP_HREF.signup} ground="pink">
                    Create an account
                </StarLpCta>
            </div>
        </Band>
    )
}
