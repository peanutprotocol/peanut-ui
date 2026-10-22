import { StarLpQrCode } from '@/components/Marketing/StarLp/StarLpQrCode'
import type { StarLpQrSlot } from '@/components/Marketing/StarLp/starLp.types'
import { twMerge } from '@/utils/tw'
import { QrArgentinaAppLink } from './QrArgentinaAppLink'

/**
 * The till's "Pagá con QR" sticker: a white card, black outline, hard shadow
 * and a scannable QR that opens Peanut. A phone cannot scan its own screen,
 * so a tap opens the same place. It presses into its shadow like the DS
 * Button (.qr-ar-press, QrArgentinaMotionStyle); hover adds no motion.
 */
export function QrArgentinaSticker({ slot, className }: { slot: StarLpQrSlot; className?: string }) {
    return (
        <QrArgentinaAppLink
            className={twMerge(
                'qr-ar-press rounded-card border-2 border-border-default bg-background-default p-2 text-center shadow-4',
                className
            )}
        >
            <span lang="es-AR" className="font-roboto-flex-extrabold block text-body-xs uppercase">
                Pagá con QR
            </span>
            <StarLpQrCode campaign="qr-argentina" slot={slot} className="mx-auto mt-2 w-[86%]" />
        </QrArgentinaAppLink>
    )
}
