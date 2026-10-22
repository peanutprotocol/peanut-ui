import PixIcon from '@/assets/payment-apps/pix.svg'
import { TillSticker } from '@/components/Marketing/StarLp/TillSticker'
import type { QrBrazilPixStickerProps } from './qrBrazil.types'

/** The "Pague com Pix" counter sticker a Brazilian shop tapes next to the till; its QrBrazilAppLink carries the press. */
export function QrBrazilPixSticker({ slot, className, priority = false }: QrBrazilPixStickerProps) {
    return (
        <TillSticker
            mark={PixIcon}
            markAlt="Pix"
            label="Pague com Pix"
            lang="pt-BR"
            campaign="qr-brazil"
            slot={slot}
            className={className}
            priority={priority}
        />
    )
}
