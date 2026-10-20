import { DrawnQrCode } from '@/components/Marketing/StarLp/DrawnQrCode'
import { twMerge } from '@/utils/tw'

/** The till's "Pagá con QR" sticker: a white card, black outline, hard shadow, a drawn QR. */
export function QrArgentinaSticker({ className }: { className?: string }) {
    return (
        <div
            lang="es-AR"
            className={twMerge(
                'rounded-card border-2 border-border-default bg-background-default p-2 text-center shadow-4',
                className
            )}
        >
            <span className="font-roboto-flex-extrabold block text-body-xs uppercase">Pagá con QR</span>
            <DrawnQrCode className="mx-auto mt-2 w-[86%]" />
        </div>
    )
}
