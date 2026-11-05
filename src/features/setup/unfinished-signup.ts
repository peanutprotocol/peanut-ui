import { AccountType, type IUserProfile } from '@/interfaces/interfaces'

export type UnfinishedSignupRoute = '/setup' | '/setup/finish'

/**
 * Where an account without a Peanut wallet finishes signup, or null when it
 * has one. The last setup step creates the wallet, so a missing wallet means
 * the flow stopped early: a reload, an app restart, or a login on a device
 * that never reached the end.
 *
 * Nothing durable records which steps were answered: the payment choices live
 * only in memory until the wallet step sends them, and a saved email says
 * nothing about the steps after it. So the account walks them all again at
 * /setup, where saved answers (the email) come back prefilled. Only an account
 * without a username, which /setup cannot resume, goes straight to the
 * wallet step at /setup/finish.
 */
export function unfinishedSignupRoute(profile: IUserProfile): UnfinishedSignupRoute | null {
    if (profile.accounts?.some((account) => account.type === AccountType.PEANUT_WALLET)) return null
    return profile.user?.username ? '/setup' : '/setup/finish'
}
