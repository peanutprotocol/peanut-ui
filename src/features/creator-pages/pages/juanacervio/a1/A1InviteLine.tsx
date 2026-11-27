import styles from '../NitaA1.module.css'

/** "With Nita's invite" under a store button: `lead`, then `name` in bold. */
export function A1InviteLine({ lead, name }: { lead: string; name: string }) {
    return (
        <p className={styles.inv}>
            {lead}
            <b>{name}</b>
        </p>
    )
}
