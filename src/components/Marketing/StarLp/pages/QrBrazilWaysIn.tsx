import { PopIn } from '@/components/Marketing/StarLp/PopIn'
import { StarLpQrCode } from '@/components/Marketing/StarLp/StarLpQrCode'

const LABEL = 'text-body-m-semibold lg:text-heading-xs'
const VALUE = 'break-all text-body-s xs:text-body-m lg:text-body-l'

/**
 * A BR Code the way a shop's copia e cola reads: the Pix GUI, a random key,
 * BRL, the pay story's shop and till price (qrBrazil.consts), a CRC. An
 * illustration with a made-up key and CRC, shown as one clipped line.
 */
const COPIA_E_COLA =
    '00020126580014br.gov.bcb.pix0136a3f0c2d4-18e0-4b6b-9c1e-7f2d5a9b0c3e520400005303986540518.005802BR5918PADARIA DA ESQUINA6009SAO PAULO62070503***6304B1D7'

/**
 * The three things Peanut pays with Pix, the key first: a Pix key is how it
 * pays a person, not only a shop (spending.md "Sending Funds to a Person":
 * any key, CPF, CNPJ, phone, email or random; a pasted copia e cola works).
 * The key is spending.md's own labelled example, "CPF 123.456.789-09", the way
 * the app shows a looked-up key. The key and the code are plain illustrations:
 * nothing to copy. The QR is real and opens Peanut, like the "Pague com Pix"
 * sticker: a bank app scanning it gets a link, not a Pix payload.
 */
export function QrBrazilWaysIn() {
    return (
        <div className="grid gap-6 text-left">
            <PopIn className="grid gap-1">
                <span className={LABEL}>Pix key</span>
                <span className={VALUE}>CPF 123.456.789-09</span>
                <span className="text-body-s lg:text-body-m">Any key: CPF, CNPJ, phone, email or random key</span>
            </PopIn>
            <PopIn className="grid gap-1" delay={0.12} tilt={-2}>
                <span className={LABEL}>Pix QR</span>
                <span className="shadow-2 block w-28 rounded-sm border-2 border-border-default bg-background-default p-1 lg:w-36">
                    <StarLpQrCode campaign="qr-brazil" slot="ways-in" className="w-full" />
                </span>
                <span className="text-body-s text-foreground-secondary">Scan this one to get the app.</span>
            </PopIn>
            <PopIn className="grid gap-1" delay={0.24}>
                <span lang="pt-BR" className={LABEL}>
                    Copia e cola
                </span>
                {/* One long line, cut by a fade at the right edge, never a typed ellipsis. */}
                <span
                    aria-hidden
                    className="block overflow-hidden mask-r-from-55% font-mono text-body-s whitespace-nowrap select-none lg:text-body-m"
                >
                    {COPIA_E_COLA}
                </span>
                <span className="sr-only">A long Pix copia e cola code</span>
            </PopIn>
        </div>
    )
}
