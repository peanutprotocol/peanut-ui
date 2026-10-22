import { Icon } from '@/components/Global/Icons/Icon'
import { PopIn } from '@/components/Marketing/StarLp/PopIn'

const LABEL = 'text-body-m-semibold lg:text-heading-xs'
const VALUE = 'break-all text-body-s xs:text-body-m lg:text-body-l'

/**
 * The three things Peanut pays at a Brazilian counter: a Pix QR, a Pix key, a
 * copia e cola code. All three are plain illustrations, not fields: there is
 * nothing to copy or scan here. The QR is a drawn glyph on purpose: a real
 * code under a "Pix QR" label would have to be a Pix payload, and a bank app
 * scanning a Peanut link there gets an invalid-Pix error. The page's one
 * scannable code is the "Pague com Pix" sticker in the hero and the close.
 */
export function QrBrazilWaysIn() {
    return (
        <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-x-4 gap-y-4 text-left xs:grid-cols-[7rem_minmax(0,1fr)] md:grid-cols-[9rem_minmax(0,1fr)] lg:grid-cols-[11rem_minmax(0,1fr)] lg:gap-x-6">
            <PopIn className="row-span-2 grid gap-1 self-end" tilt={-2}>
                <span className={LABEL}>Pix QR</span>
                <span
                    role="img"
                    aria-label="A Pix QR code"
                    className="shadow-2 block rounded-sm border-2 border-border-default bg-background-default p-1"
                >
                    <Icon name="qr-code" size="100%" aria-hidden className="block aspect-square" />
                </span>
            </PopIn>
            <PopIn className="grid gap-1" delay={0.12}>
                <span className={LABEL}>Pix key</span>
                <span className={VALUE}>12.345.678/0001-00</span>
            </PopIn>
            <PopIn className="grid gap-1" delay={0.24}>
                <span lang="pt-BR" className={LABEL}>
                    Copia e cola
                </span>
                <span className={VALUE}>000201…br.gov.bcb.pix</span>
            </PopIn>
        </div>
    )
}
