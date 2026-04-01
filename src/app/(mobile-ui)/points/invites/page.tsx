import { redirect } from 'next/navigation'

/** Backward compatibility redirect: /points/invites → /rewards/invites */
export default function PointsInvitesRedirect() {
    redirect('/rewards/invites')
}
