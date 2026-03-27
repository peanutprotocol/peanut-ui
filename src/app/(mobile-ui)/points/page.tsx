import { redirect } from 'next/navigation'

/** Backward compatibility redirect: /points → /rewards */
export default function PointsRedirect() {
    redirect('/rewards')
}
