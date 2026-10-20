import PixLogo from '@/assets/payment-apps/pix.svg'

/** Five minutes later: lunch paid with a Pix QR straight from the balance. */
export function UsEuPixPayment() {
    return (
        <div role="img" aria-label="Lunch paid with Pix: R$ 68,00" className="flex items-center gap-4">
            <span className="grid h-16 w-16 shrink-0 -rotate-3 place-items-center rounded-card border-2 border-border-default bg-background-default shadow-4 xs:h-20 xs:w-20">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={PixLogo.src}
                    width={PixLogo.width}
                    height={PixLogo.height}
                    alt="Pix"
                    loading="lazy"
                    className="h-9 w-auto"
                />
            </span>
            <span>
                <span className="block text-heading-m whitespace-nowrap">R$ 68,00</span>
                <span className="block text-body-m">Lunch</span>
            </span>
        </div>
    )
}
