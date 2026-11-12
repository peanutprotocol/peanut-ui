import { useAuth } from '@/context/authContext'
import { findPixRoute, pixPlanSetUp, type PixPlanSetUp } from '@/features/pix/pixRoute.utils'
import { useCapabilities } from '@/hooks/useCapabilities'
import { useIdentityVerification } from '@/hooks/useIdentityVerification'

/** The signed-in user's `pixPlanSetUp`: Home's Verify row, its tap and its count read it. */
export function usePixPlanSetUp(): PixPlanSetUp {
    const { user } = useAuth()
    const { capabilities, nextActions } = useCapabilities()
    const { status } = useIdentityVerification()
    return pixPlanSetUp(
        user?.signupPreferences?.fundingChannel,
        status === 'verified',
        findPixRoute(capabilities.routes, 'deposit'),
        nextActions
    )
}
