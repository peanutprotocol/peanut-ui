import Image from 'next/image'
import PixIcon from '@/assets/payment-apps/pix.svg'
import { twMerge } from '@/utils/tw'
import { StarLpQrCode } from '@/components/Marketing/StarLp/StarLpQrCode'
import type { QrBrazilPixStickerProps } from './qrBrazil.types'

/** The "Pague com Pix" counter sticker a Brazilian shop tapes next to the till. */
export function QrBrazilPixSticker({ slot, className, priority = false }: QrBrazilPixStickerProps) {
    return (
        <div
            className={twMerge(
                'rounded-card border-2 border-border-default bg-background-default p-2 text-center shadow-4 transition-shadow duration-instant group-active:shadow-none',
                className
            )}
        >
            <Image src={PixIcon} alt="Pix" priority={priority} className="mx-auto size-5" />
            <p lang="pt-BR" className="font-roboto-flex-extrabold mt-1 text-body-xs uppercase">
                Pague com Pix
            </p>
            <StarLpQrCode campaign="qr-brazil" slot={slot} className="mx-auto mt-2 w-[86%]" />
        </div>
    )
}
