import { useTranslations } from 'next-intl'
import { KYCStatusDrawerItem } from '../KYCStatusDrawerItem'
import { RejectLabelsList } from '../RejectLabelsList'
import { Callout } from '@/components/0_Bruddle/Callout'
import { Button } from '@/components/0_Bruddle/Button'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import type { IconName } from '@/components/Global/Icons/Icon'

// this component shows the identity-verification status when more action is needed
// from the user. Prefers the per-label copy when reject labels are present (e.g.
// DUPLICATE_EMAIL → "Email already in use, sign in to that account or contact
// support") and only falls back to a generic message when there are none. The
// backend's actionMessage (identity.ts → actionMessageFor) is a pure function of
// status — never label-specific — so its PRESENCE is the signal and the copy
// itself comes from the catalog, keyed off the state we're already in.
// RejectLabelsList already renders its own generic fallback for empty labels, so
// the no-labels-no-actionMessage case lands there safely.
//
// An email collision (DUPLICATE_EMAIL) is the one action_required that new
// documents cannot clear: the email belongs to another Peanut account. It gets
// the way out its own copy names (sign in to that account, or contact
// support), never "Resubmit". A FINAL rejection never reaches this component:
// the drawer shows the failed view for it.
export const KycActionRequired = ({
    onResume,
    isLoading,
    actionMessage,
    rejectLabels,
    isEmailCollision = false,
    onContactSupport,
    onLogOut,
}: {
    onResume: () => void
    isLoading?: boolean
    actionMessage?: string
    rejectLabels?: string[] | null
    /** useIdentityVerification.isEmailCollision */
    isEmailCollision?: boolean
    onContactSupport?: () => void
    /** signs out so the user can sign in to the account that owns the email */
    onLogOut?: () => void
}) => {
    const t = useTranslations('kyc')
    const tCommon = useTranslations('common')
    const tProfile = useTranslations('profile')

    if (isEmailCollision) {
        return (
            <div className="space-y-4 p-1">
                <KYCStatusDrawerItem status="pending" customText={t('actionNeeded')} />
                <RejectLabelsList rejectLabels={rejectLabels} />
                <Button className="w-full" shadowSize="4" onClick={() => onContactSupport?.()}>
                    {tCommon('contactSupport')}
                </Button>
                {onLogOut && (
                    // tertiary (design.md); pt-2 on the stack's 16px keeps the
                    // 24px its hit area needs under the primary
                    <div className="flex justify-center pt-2">
                        <LinkButton onClick={onLogOut} className="text-body-s text-foreground-primary">
                            {tProfile('logOut')}
                        </LinkButton>
                    </div>
                )}
            </div>
        )
    }

    // The generic card asks the user to continue — the required action can be a
    // follow-up questionnaire, not a re-upload. Reject labels are the real
    // re-submission case, so they keep the re-submit label. Matches the sibling
    // KycActionRequiredModal, which pairs tCommon('continue') with the retry icon.
    const isGenericAction = !rejectLabels?.length && !!actionMessage

    return (
        <div className="space-y-4 p-1">
            <KYCStatusDrawerItem status="pending" customText={t('actionNeeded')} />

            {isGenericAction ? (
                <Callout priority="error">{t('actionMessageActionRequired')}</Callout>
            ) : (
                <RejectLabelsList rejectLabels={rejectLabels} />
            )}

            <Button
                icon={'retry' as IconName}
                className="w-full"
                shadowSize="4"
                onClick={() => onResume()}
                disabled={isLoading}
            >
                {isLoading ? tCommon('loading') : isGenericAction ? tCommon('continue') : t('resubmitVerification')}
            </Button>
        </div>
    )
}
