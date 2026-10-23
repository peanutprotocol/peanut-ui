import { KYC_PROCESSING_STALE_AFTER_MS } from '@/constants/kyc.consts'
import { isBridgeProcessingSlow } from '@/utils/kyc-processing.utils'
import { useTranslations } from 'next-intl'
import { reasonCodeKey } from '@/constants/capability-reason-labels.consts'
import type { CapabilityReason } from '@/types/capabilities'
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
    reason?: CapabilityReason
    /** Re-opens the verification, so one the user left unfinished can be completed. */
    onResume?: () => void
    onContactSupport?: () => void
}

// shown when user clicks a locked region while their kyc is pending/in review
export const KycProcessingModal = ({
    visible,
    onClose,
    pendingSince,
    waitingOnProvider = false,
    reason,
    onResume,
    onContactSupport,
}: KycProcessingModalProps) => {
    const t = useTranslations('kyc')
    const tCommon = useTranslations('common')
    const tIdentity = useTranslations('identity')
    const supplementInReview = reason?.code === 'requirements_in_review'
    const slow = isBridgeProcessingSlow(reason?.code, pendingSince)
    const reasonKey = slow
        ? 'reasons.bridge_processing_slow'
        : supplementInReview
          ? reasonCodeKey(reason.code)
          : undefined

    const pendingSinceMs = pendingSince ? Date.parse(pendingSince) : NaN
    const isStale = Number.isFinite(pendingSinceMs) && Date.now() - pendingSinceMs > KYC_PROCESSING_STALE_AFTER_MS
    // Only an unfinished verification has something the user can continue; a
    // provider review does not, so that branch offers support and nothing else.
    const canResume = isStale && !slow && !waitingOnProvider && !supplementInReview && !!onResume

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
                            <DrawerDescription
                                data-testid={supplementInReview ? 'kyc-supplement-in-review' : undefined}
                            >
                                {reasonKey
                                    ? tIdentity(reasonKey)
                                    : canResume
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
                        {isStale && !supplementInReview && onContactSupport && (
                            <LinkButton onClick={onContactSupport}>{tCommon('contactSupport')}</LinkButton>
                        )}
                    </div>
                </div>
            </DrawerContent>
        </Drawer>
    )
}
