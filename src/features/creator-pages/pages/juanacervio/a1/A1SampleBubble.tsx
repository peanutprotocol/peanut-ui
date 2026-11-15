import type { ReactNode } from 'react'
import styles from '../NitaA1.module.css'

/** The round leading or trailing mark of a sample row: a currency code or an icon on a brand fill. */
export function A1SampleBubble({ fill, children }: { fill: 'green' | 'blue' | 'yellow'; children: ReactNode }) {
    return <span className={styles[fill]}>{children}</span>
}
