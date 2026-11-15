import { CreatorPageCta } from '../../../CreatorPageCta'
import type { CtaPosition } from '../../../events'
import { NITA_A1_COPY as copy } from '../nita-a1.copy'

/** The store button of variant A1: the DS large primary button, on the one shared creator-page link. */
export function A1Cta({ position }: { position: CtaPosition }) {
    return (
        <CreatorPageCta
            className="btn btn-primary btn-large notranslate w-full gap-2 no-underline transition-all duration-instant active:translate-x-1 active:translate-y-1 active:shadow-none"
            labels={copy.cta}
            showStoreIcon
            position={position}
        />
    )
}
