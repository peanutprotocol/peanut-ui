import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import ActionModal from '@/components/Global/ActionModal'
import { type IconName } from '@/components/Global/Icons/Icon'
import { PeanutDoesntStoreAnyPersonalInformation } from '@/components/Kyc/PeanutDoesntStoreAnyPersonalInformation'
import { type KycModalPhase } from '@/interfaces/interfaces'
import { useBridgeProviderId } from '@/hooks/useBridgeProviderId'
import { BridgeTermsCard } from '@/components/Kyc/BridgeTermsCard'
import { useKycControl } from '@/features/paperwork-verification/analytics'

export interface KycCompletionNotice {
    kind: 'action' | 'review'
    currencies: string[]
}

interface KycVerificationInProgressModalProps {
    isOpen: boolean
    onClose: () => void
    phase?: KycModalPhase
    onAcceptTerms?: () => void
    onSkipTerms?: () => void
    onStartSupplement?: () => void
    onSkipSupplement?: () => void
    onContinue?: () => void
    tosError?: string | null
    isLoadingTos?: boolean
    preparingTimedOut?: boolean
    preparingStage?: 'initial' | 'configuring' | 'slow'
    completionNotice?: KycCompletionNotice | null
}

const PHASE_SCREEN: Record<KycModalPhase, string> = {
    preparing: 'account-setup',
    verifying: 'id-checking',
    submitted: 'id-checking',
    bridge_tos: 'tos',
    supplement: 'poa',
    complete: 'id-confirmed',
}

// multi-phase modal shown during and after kyc verification.
// phase transitions are controlled by the parent orchestrator (SumsubKycFlow).
export const KycVerificationInProgressModal = ({
    isOpen,
    onClose,
    phase = 'verifying',
    onAcceptTerms,
    onStartSupplement,
    onSkipSupplement,
    onContinue,
    tosError,
    isLoadingTos,
    preparingTimedOut,
    preparingStage = 'initial',
    completionNotice,
}: KycVerificationInProgressModalProps) => {
    const { track } = useKycControl(PHASE_SCREEN[phase], 'kyc_legacy')
    const handleClose = () => {
        track('verification', 'dismiss')
        onClose()
    }
    const router = useRouter()
    const t = useTranslations('kyc')
    const tCommon = useTranslations('common')
    const providerId = useBridgeProviderId()

    // At 90 seconds the waiting copy admits the check is probably getting a
    // closer look, instead of holding "usually fast" forever.
    const [stillGoing, setStillGoing] = useState(false)
    useEffect(() => {
        if (!(isOpen && phase === 'verifying')) {
            setStillGoing(false)
            return
        }
        const timer = setTimeout(() => setStillGoing(true), 90_000)
        return () => clearTimeout(timer)
    }, [isOpen, phase])

    const handleGoHome = () => {
        track('home', 'tap')
        onClose()
        router.push('/home')
    }

    if (phase === 'submitted') {
        return (
            <ActionModal
                visible={isOpen}
                onClose={handleClose}
                tone="attention"
                icon={'clock' as IconName}
                title={t('submitted')}
                description={t('progress.submittedDescription')}
                ctas={[{ text: t('progress.closeAndNotify'), onClick: handleGoHome, variant: 'primary' }]}
                footer={<PeanutDoesntStoreAnyPersonalInformation onOpen={() => track('privacy_help', 'tap')} />}
            />
        )
    }

    if (phase === 'verifying') {
        // Dismissible on purpose (no preventClose): waiting is optional. The
        // decision arrives as a notification either way, so closing costs
        // nothing — the CTA says exactly that.
        return (
            <ActionModal
                visible={isOpen}
                onClose={handleClose}
                tone="attention"
                icon={'clock' as IconName}
                title={t('progress.verifyingTitle')}
                description={
                    <p>{stillGoing ? t('progress.verifyingStillGoing') : t('progress.verifyingDescription')}</p>
                }
                ctas={[
                    {
                        text: t('progress.closeAndNotify'),
                        onClick: handleGoHome,
                        variant: 'primary',
                        className: 'w-full',
                        shadowSize: '4',
                    },
                ]}
                footer={<PeanutDoesntStoreAnyPersonalInformation onOpen={() => track('privacy_help', 'tap')} />}
            />
        )
    }

    if (phase === 'preparing') {
        // Progressive copy based on elapsed time in preparing phase
        const getPreparingCopy = () => {
            if (preparingTimedOut) {
                return {
                    title: t('progress.preparingTimedOutTitle'),
                    description: t('progress.preparingTimedOutDescription'),
                }
            }
            switch (preparingStage) {
                case 'configuring':
                    return {
                        title: t('progress.preparingTitle'),
                        description: t('progress.preparingConfiguringDescription'),
                    }
                case 'slow':
                    return {
                        title: t('progress.preparingSlowTitle'),
                        description: t('progress.preparingSlowDescription'),
                    }
                case 'initial':
                default:
                    return {
                        title: t('progress.preparingTitle'),
                        description: t('progress.preparingInitialDescription'),
                    }
            }
        }

        const { title, description } = getPreparingCopy()

        return (
            <ActionModal
                visible={isOpen}
                onClose={handleClose}
                tone="attention"
                isLoadingIcon
                title={title}
                description={description}
                ctas={
                    preparingTimedOut
                        ? [
                              {
                                  text: tCommon('goToHome'),
                                  onClick: handleGoHome,
                                  variant: 'primary',
                                  className: 'w-full',
                                  shadowSize: '4',
                              },
                          ]
                        : []
                }
                preventClose
                hideModalCloseButton
            />
        )
    }

    if (phase === 'bridge_tos') {
        return (
            <ActionModal
                visible={isOpen}
                onClose={handleClose}
                tone="success"
                icon={'check' as IconName}
                title={t('bridgeTos.title')}
                description={tosError || t('bridgeTos.lastStepDescription')}
                content={tosError ? undefined : <BridgeTermsCard providerId={providerId} />}
                ctas={[
                    {
                        // Continue, not Accept: the user accepts on Bridge's page
                        text: tCommon('continue'),
                        onClick: () => {
                            track('continue', 'tap')
                            if (!tosError && onAcceptTerms) onAcceptTerms()
                            else onClose()
                        },
                        disabled: isLoadingTos,
                        variant: 'primary',
                        className: 'w-full',
                        shadowSize: '4',
                    },
                ]}
                preventClose
                hideModalCloseButton
            />
        )
    }

    if (phase === 'supplement') {
        const skipSupplement = onSkipSupplement ?? onClose
        return (
            <ActionModal
                visible={isOpen}
                onClose={() => {
                    track('poa', 'dismiss')
                    skipSupplement()
                }}
                tone="success"
                icon={'check' as IconName}
                title={t('supplement.proofOfAddressTitle')}
                description={t('supplement.proofOfAddressDescription')}
                ctas={[
                    {
                        text: t('supplement.proofOfAddressCta'),
                        onClick: () => {
                            track('continue', 'tap')
                            if (onStartSupplement) onStartSupplement()
                            else onClose()
                        },
                        variant: 'primary',
                        className: 'w-full',
                        shadowSize: '4',
                        'data-testid': 'kyc-supplement-cta',
                    },
                ]}
                tertiaryCta={{
                    text: t('supplement.later'),
                    onClick: () => {
                        track('not_now', 'tap')
                        skipSupplement()
                    },
                    'data-testid': 'kyc-supplement-later',
                }}
            />
        )
    }

    // phase === 'complete'
    // Deliberately neutral (not "You're unlocked"): home's rich activation
    // celebration was deleted with TASK-22680 and nothing replaces it yet, so
    // this terminal is the only KYC-complete surface. It still does not stamp
    // activationCelebratedAt.
    return (
        <ActionModal
            visible={isOpen}
            onClose={handleClose}
            tone="success"
            icon={'check' as IconName}
            title={t(completionNotice ? 'progress.accountReadyTitle' : 'progress.completeTitle')}
            description={
                completionNotice
                    ? completionNotice.currencies.length
                        ? t(
                              completionNotice.kind === 'action'
                                  ? 'progress.accountReadyAction'
                                  : 'progress.accountReadyReview',
                              {
                                  currencies: completionNotice.currencies.join(', '),
                                  count: completionNotice.currencies.length,
                              }
                          )
                        : t(
                              completionNotice.kind === 'action'
                                  ? 'progress.accountReadyActionGeneric'
                                  : 'progress.accountReadyReviewGeneric'
                          )
                    : t('progress.completeDescription')
            }
            ctas={[
                {
                    text: tCommon('continue'),
                    onClick: () => {
                        track('continue', 'tap')
                        if (onContinue) onContinue()
                        else onClose()
                    },
                    variant: 'primary',
                    className: 'w-full',
                    shadowSize: '4',
                },
            ]}
        />
    )
}
