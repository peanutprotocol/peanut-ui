import { Band } from '@/components/Marketing/StarLp/Band'
import { DropIn } from '@/components/Marketing/StarLp/DropIn'
import { KnerdTitle } from '@/components/Marketing/StarLp/KnerdTitle'
import { StarLpCta } from '@/components/Marketing/StarLp/StarLpCta'
import { STAR_LP_HREF } from '@/components/Marketing/StarLp/starLp.consts'
import { QrBrazilAppLink } from './QrBrazilAppLink'
import { QrBrazilPixSticker } from './QrBrazilPixSticker'
import { QrBrazilScanFrame } from './QrBrazilScanFrame'

/**
 * The closing fold: PIX IT over the counter sticker inside the scanner's
 * frame. The sticker drops in, then the frame locks on. Built from
 * CloseFold's parts because CloseFold has no slot for art between the title
 * and the line.
 */
export function QrBrazilClose() {
    return (
        <Band ground="pink" align="center">
            <h2>
                <KnerdTitle text="Pix it" size="hero" />
            </h2>
            <QrBrazilScanFrame className="mx-auto mt-12 w-52 md:w-60">
                <DropIn fromTilt={-18} tilt={-5}>
                    <QrBrazilAppLink>
                        <QrBrazilPixSticker slot="close-sticker" />
                    </QrBrazilAppLink>
                </DropIn>
            </QrBrazilScanFrame>
            <p className="mx-auto mt-14 max-w-xl text-body-l">Verify with your passport before you land.</p>
            <div className="mx-auto mt-8 w-fit">
                <StarLpCta qrPlacement="close" href={STAR_LP_HREF.signup} ground="pink">
                    Create an account
                </StarLpCta>
            </div>
        </Band>
    )
}
