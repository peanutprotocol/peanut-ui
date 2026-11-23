import type { ReactNode } from 'react'
import styles from '../NitaA1.module.css'

/**
 * One row of sample app UI inside a proof card. An illustration, not a control.
 * `trailing` keeps its width; the text wraps, and `trailing` moves under it when even one word no longer fits beside it.
 */
export function A1SampleRow({
    leading,
    title,
    note,
    trailing,
}: {
    leading: ReactNode
    title: string
    note: string
    trailing?: ReactNode
}) {
    return (
        <div className={styles.row}>
            {leading}
            <div>
                <p>{title}</p>
                <p>{note}</p>
            </div>
            {trailing}
        </div>
    )
}
