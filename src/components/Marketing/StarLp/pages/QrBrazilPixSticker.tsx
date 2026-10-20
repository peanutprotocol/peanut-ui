import Image from 'next/image'
import PixIcon from '@/assets/payment-apps/pix.svg'
import { twMerge } from '@/utils/tw'
import { QrBrazilQrCode } from './QrBrazilQrCode'
import type { QrBrazilPixStickerProps } from './qrBrazil.types'

/** The "Pague com Pix" counter sticker a Brazilian shop tapes next to the till. */
export function QrBrazilPixSticker({ className, priority = false }: QrBrazilPixStickerProps) {
    return (
        <div
            className={twMerge(
                'shadow-2 rounded-card border-2 border-border-default bg-background-default p-2 text-center',
                className
            )}
        >
            <Image src={PixIcon} alt="Pix" priority={priority} className="mx-auto size-5" />
            <p lang="pt-BR" className="font-roboto-flex-extrabold mt-1 text-body-xs uppercase">
                Pague com Pix
            </p>
            <QrBrazilQrCode className="mx-auto mt-2 w-[86%]" />
        </div>
    )
}
