import { AccountType, type IUserProfile } from '@/interfaces/interfaces'

export type UnfinishedSignupRoute = '/setup' | '/setup/finish'

/**
 * Where an account without a Peanut wallet finishes signup, or null when it
 * has one. The last setup step creates the wallet, so a missing wallet means
 * the flow stopped early: a reload, an app restart, or a login on a device
 * that never reached the end.
 *
 * The email is the last answer the steps require before that step. Without it
 * the account walks the steps again at /setup, which can only resume an
 * account that registration gave a username. With it, only the wallet is
 * missing, and /setup/finish creates just that.
 */
export function unfinishedSignupRoute(profile: IUserProfile): UnfinishedSignupRoute | null {
    if (profile.accounts?.some((account) => account.type === AccountType.PEANUT_WALLET)) return null
    return profile.user?.username && !profile.user.email ? '/setup' : '/setup/finish'
}
