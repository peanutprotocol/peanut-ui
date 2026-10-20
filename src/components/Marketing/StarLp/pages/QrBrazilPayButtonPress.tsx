import { QR_BRAZIL_PAY_BUTTON, QR_BRAZIL_PAY_CAPTURE } from './qrBrazil.consts'
import type { QrBrazilPayButtonPressProps } from './qrBrazil.types'

const W = QR_BRAZIL_PAY_CAPTURE.width
const pct = (value: number, of: number) => `${(value / of) * 100}%`
/** Page background kept round the button, in capture px: the pressed button shrinks inside it, never past it. */
const PRESS_MARGIN = 12

/**
 * A copy of the capture's own Pay button, cut from the same image and laid
 * exactly over it, so it can press: scale 0.96 with an 8% dark flash
 * (.qr-br-tap, QrBrazilMotionStyle). The cut keeps a margin of page
 * background, so the shrinking button never shows the still one beneath.
 */
export function QrBrazilPayButtonPress({ src, variant, pressed }: QrBrazilPayButtonPressProps) {
    const button = QR_BRAZIL_PAY_BUTTON[variant]
    const left = button.left - PRESS_MARGIN
    const top = button.top - PRESS_MARGIN
    const width = button.width + PRESS_MARGIN * 2
    const height = button.buttonHeight + PRESS_MARGIN * 2
    return (
        <span
            aria-hidden
            className="qr-br-tap absolute block"
            data-pressed={pressed}
            data-story-beat={1}
            style={{
                left: pct(left, W),
                top: pct(top, button.height),
                width: pct(width, W),
                height: pct(height, button.height),
                backgroundImage: `url(${src})`,
                backgroundSize: `${(W / width) * 100}% ${(button.height / height) * 100}%`,
                backgroundPosition: `${(left / (W - width)) * 100}% ${(top / (button.height - height)) * 100}%`,
            }}
        />
    )
}
