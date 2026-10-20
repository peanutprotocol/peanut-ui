export interface QrBrazilQrCodeProps {
    /** Width classes; the code is square. */
    className?: string
}

export interface QrBrazilPixStickerProps {
    /** Width classes; the sticker scales with its width. */
    className?: string
    /** Load the Pix logo eagerly; set only where the sticker is in the first screen. */
    priority?: boolean
}
