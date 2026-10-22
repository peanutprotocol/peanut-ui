import MercadoPagoIcon from '@/assets/payment-apps/mercado-pago.svg'
import { TillSticker } from '@/components/Marketing/StarLp/TillSticker'
import type { StarLpQrSlot } from '@/components/Marketing/StarLp/starLp.types'
import { QrArgentinaAppLink } from './QrArgentinaAppLink'

/**
 * The Argentine till's sticker: the Mercado Pago mark over "Pagá con QR"
 * (spending.md: only Mercado Pago QR is supported) and a code that opens
 * Peanut. A phone cannot scan its own screen, so a tap opens the same place,
 * with the DS press (.qr-ar-press, QrArgentinaMotionStyle). The hero's
 * sticker is in the first screen, so it loads its mark eagerly.
 */
export function QrArgentinaSticker({ slot, className }: { slot: StarLpQrSlot; className?: string }) {
    return (
        <QrArgentinaAppLink className="qr-ar-press group">
            <TillSticker
                mark={MercadoPagoIcon}
                markAlt="Mercado Pago"
                label="Pagá con QR"
                lang="es-AR"
                campaign="qr-argentina"
                slot={slot}
                className={className}
                priority={slot === 'hero-sticker'}
            />
        </QrArgentinaAppLink>
    )
}
