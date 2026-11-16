import { NITA_A1_COPY as copy } from '../nita-a1.copy'
import styles from '../NitaA1.module.css'

/** "Con la invitación de Nita" under a store button. */
export function A1InviteLine() {
    return (
        <p className={styles.inv}>
            {copy.inviteLead}
            <b>{copy.inviteName}</b>
        </p>
    )
}
