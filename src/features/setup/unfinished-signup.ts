import { AccountType, type IUserProfile } from '@/interfaces/interfaces'

export type UnfinishedSignupRoute = '/setup' | '/setup/finish'

/**
 * Since ui#3560 reached production, signup cannot finish without an email. An older account may have none: the
 * Home add-email card asks it, signup does not.
 */
export const EMAIL_REQUIRED_SINCE = Date.parse('2026-10-07T11:16:09Z')

/**
 * Where an unfinished signup continues, or null when it is finished. The last
 * setup step creates the wallet, so a missing wallet means the flow stopped
 * early: a reload, an app restart, or a login on a device that never reached
 * the end.
 *
 * Nothing durable records which steps were answered: the payment choices live
 * only in memory until the wallet step sends them, and a saved email says
 * nothing about the steps after it. So the account walks them all again at
 * /setup, where saved answers (the email) come back prefilled. Only an account
 * without a username, which /setup cannot resume, goes straight to the
 * wallet step at /setup/finish.
 *
 * A wallet without an email is unfinished too when the account is newer than
 * EMAIL_REQUIRED_SINCE (TASK-25379: the email step once let a dormant holder's
 * address through unsaved). /setup resumes it at the email step.
 */
export function unfinishedSignupRoute(profile: IUserProfile): UnfinishedSignupRoute | null {
    const username = profile.user?.username
    if (!profile.accounts?.some((account) => account.type === AccountType.PEANUT_WALLET)) {
        return username ? '/setup' : '/setup/finish'
    }
    // /setup/finish only creates a wallet, so an account without a username has nowhere to give an email.
    if (!username || profile.user?.email?.trim()) return null
    return Date.parse(profile.user.createdAt) >= EMAIL_REQUIRED_SINCE ? '/setup' : null
}
