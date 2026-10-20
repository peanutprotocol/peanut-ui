import Link from 'next/link'
import PixLogo from '@/assets/payment-apps/pix.svg'
import { STAR_LP_ROUTES } from '@/components/Marketing/StarLp/starLp.consts'

/**
 * Five minutes later: lunch paid with a Pix QR straight from the balance. The
 * Pix sticker stamps down when its beat shows (star-lp-stamp) and the row
 * opens the Brazil QR page, which shows how that payment works.
 */
export function UsEuPixPayment() {
    return (
        <Link
            href={STAR_LP_ROUTES.qrBrazil}
            aria-label="Lunch paid with Pix: R$ 68,00. See how Pix QR payments work"
            className="group star-lp-own-entrance flex w-fit items-center gap-4 rounded-card"
        >
            <span className="star-lp-stamp grid h-16 w-16 shrink-0 -rotate-3 place-items-center rounded-card border-2 border-border-default bg-background-default shadow-4 group-active:translate-x-[3px] group-active:translate-y-[3px] group-active:shadow-none motion-safe:transition-[translate,box-shadow] motion-safe:duration-instant xs:h-20 xs:w-20">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={PixLogo.src}
                    width={PixLogo.width}
                    height={PixLogo.height}
                    alt=""
                    loading="lazy"
                    className="h-9 w-auto"
                />
            </span>
            <span aria-hidden>
                <span className="block text-heading-m whitespace-nowrap">R$ 68,00</span>
                <span className="block text-body-m">Lunch</span>
            </span>
        </Link>
    )
}
