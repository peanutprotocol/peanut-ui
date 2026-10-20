import type { ReactNode } from 'react'
import type { StarLpFxRate, StarLpQrSlot } from '@/components/Marketing/StarLp/starLp.types'

export interface QrBrazilPixStickerProps {
    /** Where the sticker sits; tags the QR's utm_content. */
    slot: StarLpQrSlot
    /** Width classes; the sticker scales with its width. */
    className?: string
    /** Load the Pix logo eagerly; set only where the sticker is in the first screen. */
    priority?: boolean
}

export interface QrBrazilAppLinkProps {
    children: ReactNode
    className?: string
    /**
     * Accessible name. Without one the link repeats a CTA that sits right next
     * to it, so it stays out of the tab order and the accessibility tree.
     */
    label?: string
}

export interface QrBrazilPayStoryProps {
    /** Live USD→BRL (Manteca sell); null hides every converted figure. */
    usdBrl: StarLpFxRate | null
}

export interface QrBrazilPayCaptureProps {
    /** Live USD→BRL (Manteca sell); null swaps in the capture without the converted rows. */
    usdBrl: StarLpFxRate | null
    /** True plays one tap on the capture's Pay button (the story's press beat). */
    pressed: boolean
}

export interface QrBrazilPayButtonPressProps {
    /** The capture image the button is cut from. */
    src: string
    /** Which capture: with the live rate rows, or without them. */
    variant: 'live' | 'norate'
    pressed: boolean
}

export interface QrBrazilScanFrameProps {
    children: ReactNode
    className?: string
}
