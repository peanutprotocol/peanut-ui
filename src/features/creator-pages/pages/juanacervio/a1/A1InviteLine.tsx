import { NITA_A1_COPY as copy } from '../nita-a1.copy'

/** "Con la invitación de Nita." under a store button. */
export function A1InviteLine({ className }: { className: string }) {
    return (
        <p className={`mt-3 text-center text-body-s ${className}`}>
            {copy.inviteLead}
            <b className="font-extrabold text-foreground-primary">{copy.inviteName}</b>.
        </p>
    )
}
