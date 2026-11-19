import { Band } from '@/components/Marketing/StarLp/Band'
import { DropIn } from '@/components/Marketing/StarLp/DropIn'
import { KnerdTitle } from '@/components/Marketing/StarLp/KnerdTitle'
import { ScanFrame } from '@/components/Marketing/StarLp/ScanFrame'
import { StarLpCta } from '@/components/Marketing/StarLp/StarLpCta'
import { QrBrazilAppLink } from './QrBrazilAppLink'
import { QrBrazilPixSticker } from './QrBrazilPixSticker'

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
            {/* corners 20px clear of the sticker, with the fold's old spacing: the frame's padding is taken back out of its margins */}
            <ScanFrame scanLine={false} className="mt-7 -mb-5 w-62 p-5 md:w-70">
                <DropIn fromTilt={-18} tilt={-5}>
                    <QrBrazilAppLink>
                        <QrBrazilPixSticker slot="close-sticker" />
                    </QrBrazilAppLink>
                </DropIn>
            </ScanFrame>
            <p className="mx-auto mt-14 max-w-xl text-body-l">Verify with your passport before you land.</p>
            <div className="mx-auto mt-8 w-fit">
                <StarLpCta qrPlacement="close" ground="pink">
                    Create an account
                </StarLpCta>
            </div>
        </Band>
    )
}
