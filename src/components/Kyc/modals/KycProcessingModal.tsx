import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/Global/Drawer'

interface KycProcessingModalProps {
    visible: boolean
    onClose: () => void
    /** When the rail last changed (capability `pendingSince`). Absent reads as fresh. */
    pendingSince?: string | null
    /** The provider is reviewing (a `wait` next action): nothing for the user to finish. */
    waitingOnProvider?: boolean
    /** Re-opens the verification, so one the user left unfinished can be completed. */
    onResume?: () => void
    onContactSupport?: () => void
}

/**
 * Past this, "less than a minute" is a lie. A rail pending for a day is one the
 * user walked away from before the provider's questionnaire (the awaiting-action
 * ghost, 189 users in prod on 2026-09-22) or one stuck in provider review.
 */
const STALE_AFTER_MS = 24 * 60 * 60 * 1000

// shown when user clicks a locked region while their kyc is pending/in review
export const KycProcessingModal = ({
    visible,
    onClose,
    pendingSince,
    waitingOnProvider = false,
    onResume,
    onContactSupport,
}: KycProcessingModalProps) => {
    const t = useTranslations('kyc')
    const tCommon = useTranslations('common')

    const pendingSinceMs = pendingSince ? Date.parse(pendingSince) : NaN
    const isStale = Number.isFinite(pendingSinceMs) && Date.now() - pendingSinceMs > STALE_AFTER_MS
    // Only an unfinished verification has something the user can continue; a
    // provider review does not, so that branch offers support and nothing else.
    const canResume = isStale && !waitingOnProvider && !!onResume

    return (
        <Drawer
            open={visible}
            onOpenChange={(isOpen) => {
                if (!isOpen) onClose()
            }}
        >
            <DrawerContent>
                <div className="flex flex-col items-center pt-1 pb-6 text-center">
                    {/* the head owns the M/12 beneath it; everything after it
                        keeps the drawer's L/16 rhythm */}
                    <div className="mb-3 flex w-full flex-col items-center gap-4">
                        <IconBubble icon="clock" color="yellow" />
                        <DrawerHeader className="w-full gap-2 p-0 text-center sm:text-center">
                            <DrawerTitle>{isStale ? t('processingStaleTitle') : t('processingTitle')}</DrawerTitle>
                            <DrawerDescription>
                                {canResume
                                    ? t('processingUnfinishedDescription')
                                    : isStale
                                      ? t('processingReviewDescription')
                                      : t('processingDescription')}
                            </DrawerDescription>
                        </DrawerHeader>
                    </div>
                    {/* gap-6: the LinkButton's hit area reaches 14px above its text */}
                    <div className="flex w-full flex-col items-center gap-6">
                        {canResume ? (
                            <Button shadowSize="4" className="w-full justify-center" onClick={onResume}>
                                {t('continueVerification')}
                            </Button>
                        ) : (
                            <Button shadowSize="4" className="w-full justify-center" onClick={onClose}>
                                {tCommon('gotIt')}
                            </Button>
                        )}
                        {isStale && onContactSupport && (
                            <LinkButton onClick={onContactSupport}>{tCommon('contactSupport')}</LinkButton>
                        )}
                    </div>
                </div>
            </DrawerContent>
        </Drawer>
    )
}
