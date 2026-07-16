import { useTranslations } from 'next-intl'
import ActionModal from '@/components/Global/ActionModal'
import { type IconName } from '@/components/Global/Icons/Icon'
import { PeanutDoesntStoreAnyPersonalInformation } from '@/components/Kyc/PeanutDoesntStoreAnyPersonalInformation'

interface InitiateKycModalProps {
    visible: boolean
    onClose: () => void
    onVerify: () => void
    onContactSupport?: () => void
    isLoading?: boolean
    /** error message from a failed verify/resubmit attempt */
    error?: string | null
    /** when set, shows context-specific messaging instead of the generic "unlock" copy */
    variant?: 'default' | 'provider_rejection' | 'blocked' | 'restart_identity' | 'cross_region'
    providerMessage?: string
    /** country name shown in cross_region variant (e.g. "Brazil", "Argentina") */
    regionName?: string
}

// confirmation modal shown before starting identity check or document resubmission.
// default            → "Unlock your account" — verb is "unlock", ID check is the means
// provider_rejection → "We need extra documents"
// blocked            → "We couldn't unlock this — contact support"
// restart_identity   → "Verify with a different document" (self-fix for country mismatch)
// cross_region       → "Unlock {region}"
export const InitiateKycModal = ({
    visible,
    onClose,
    onVerify,
    onContactSupport,
    isLoading,
    error,
    variant = 'default',
    providerMessage,
    regionName,
}: InitiateKycModalProps) => {
    const t = useTranslations('kyc')
    const tCommon = useTranslations('common')
    const isProviderRejection = variant === 'provider_rejection'
    const isBlocked = variant === 'blocked'
    const isRestartIdentity = variant === 'restart_identity'
    const isCrossRegion = variant === 'cross_region'

    const getTitle = () => {
        if (error) return tCommon('somethingWentWrong')
        if (isBlocked) return t('initiate.titleBlocked')
        if (isRestartIdentity) return t('initiate.titleRestartIdentity')
        if (isProviderRejection) return t('initiate.titleProviderRejection')
        if (isCrossRegion)
            return regionName
                ? t('initiate.titleCrossRegion', { region: regionName })
                : t('initiate.titleCrossRegionGeneric')
        return t('initiate.titleDefault')
    }

    const getDescription = () => {
        if (error) return t('initiate.descriptionError', { error })
        if (isBlocked) return providerMessage || t('initiate.descriptionBlocked')
        if (isRestartIdentity) return providerMessage || t('initiate.descriptionRestartIdentity')
        if (isProviderRejection) return providerMessage || t('initiate.descriptionProviderRejection')
        if (isCrossRegion) {
            return regionName
                ? t('initiate.descriptionCrossRegion', { region: regionName })
                : t('initiate.descriptionCrossRegionGeneric')
        }
        return t('initiate.descriptionDefault')
    }

    const getCta = () => {
        if (error || isBlocked) {
            return {
                text: tCommon('contactSupport'),
                onClick: onContactSupport ?? onClose,
            }
        }
        if (isRestartIdentity) {
            return {
                text: isLoading ? tCommon('loading') : t('initiate.titleRestartIdentity'),
                onClick: onVerify,
                icon: 'upload' as IconName,
            }
        }
        if (isProviderRejection) {
            return {
                text: isLoading ? tCommon('loading') : t('initiate.ctaUploadDocument'),
                onClick: onVerify,
                icon: 'upload' as IconName,
            }
        }
        if (isCrossRegion) {
            return {
                text: tCommon(isLoading ? 'loading' : 'continue'),
                onClick: onVerify,
            }
        }
        return {
            text: isLoading ? tCommon('loading') : t('initiate.ctaUnlockNow'),
            onClick: onVerify,
            icon: 'check-circle' as IconName,
        }
    }

    const cta = getCta()

    return (
        <ActionModal
            visible={visible}
            onClose={onClose}
            title={getTitle()}
            description={getDescription()}
            preventClose
            icon={(error || isBlocked || isRestartIdentity ? 'alert' : 'badge') as IconName}
            iconContainerClassName={isBlocked || isRestartIdentity ? 'bg-yellow-1' : ''}
            modalPanelClassName="max-w-full m-2"
            ctaClassName="grid grid-cols-1 gap-3"
            ctas={[
                {
                    text: cta.text,
                    onClick: cta.onClick,
                    variant: 'purple',
                    disabled: isLoading && !isBlocked,
                    shadowSize: '4',
                    ...(cta.icon ? { icon: cta.icon } : {}),
                    className: 'h-11',
                },
            ]}
            footer={
                isProviderRejection || isBlocked || isRestartIdentity ? undefined : (
                    <PeanutDoesntStoreAnyPersonalInformation className="w-full justify-center" />
                )
            }
        />
    )
}
