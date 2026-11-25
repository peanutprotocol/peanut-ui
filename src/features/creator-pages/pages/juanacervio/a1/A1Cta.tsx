import { CreatorPageCta } from '../../../CreatorPageCta'
import type { CtaPosition } from '../../../events'
import type { NitaA1Copy } from '../nita-a1.copy'
import styles from '../NitaA1.module.css'

/**
 * The store button of variant A1: the DS large primary button, on the one shared creator-page link.
 * `styles.cta` holds what A1 changes on it (it grows with its label, 16px side padding, the press move).
 */
export function A1Cta({ labels, position }: { labels: NitaA1Copy['cta']; position: CtaPosition }) {
    return (
        <CreatorPageCta
            className={`btn btn-primary btn-large notranslate ${styles.cta}`}
            labels={labels}
            position={position}
        />
    )
}
