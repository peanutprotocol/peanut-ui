import { CreatorPageCta } from '../../../CreatorPageCta'
import type { CtaPosition } from '../../../events'
import { NITA_A1_COPY as copy } from '../nita-a1.copy'

/**
 * The store button of variant A1: the DS large primary button, on the one shared creator-page link.
 * It grows instead of clipping when a large text setting wraps the label onto two lines.
 */
export function A1Cta({ position }: { position: CtaPosition }) {
    return (
        <CreatorPageCta
            className="btn btn-primary btn-large notranslate h-auto min-h-12 w-full gap-2 py-2 text-center no-underline transition-all duration-instant active:translate-x-1 active:translate-y-1 active:shadow-none"
            labels={copy.cta}
            showStoreIcon
            position={position}
        />
    )
}
