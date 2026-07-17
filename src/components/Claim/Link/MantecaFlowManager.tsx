'use client'

import MERCADO_PAGO from '@/assets/payment-apps/mercado-pago.svg'
import PIX from '@/assets/payment-apps/pix.svg'
import NavHeader from '@/components/Global/NavHeader'
import PeanutActionDetailsCard from '@/components/Global/PeanutActionDetailsCard'
import { useClaimBankFlow } from '@/context/ClaimBankFlowContext'
import { type ClaimLinkData } from '@/services/sendLinks'
import { type FC, useEffect, useMemo, useState } from 'react'
import MantecaDetailsStep from './views/MantecaDetailsStep.view'
import { MercadoPagoStep } from '@/types/manteca.types'
import MantecaReviewStep from './views/MantecaReviewStep'
import { Button } from '@/components/0_Bruddle/Button'
import ErrorAlert from '@/components/Global/ErrorAlert'
import { useRouter } from 'next/navigation'
import { useCapabilities } from '@/hooks/useCapabilities'
import { useMultiPhaseKycFlow } from '@/hooks/useMultiPhaseKycFlow'
import { SumsubKycModals } from '@/components/Kyc/SumsubKycModals'
import { InitiateKycModal } from '@/components/Kyc/InitiateKycModal'
import { deriveProviderRejection } from '@/utils/provider-rejection.utils'
import { useTranslations } from 'next-intl'

interface MantecaFlowManagerProps {
    claimLinkData: ClaimLinkData
    amount: string
    attachment: { message: string | undefined; attachmentUrl: string | undefined }
}

const MantecaFlowManager: FC<MantecaFlowManagerProps> = ({ claimLinkData, amount, attachment }) => {
    const t = useTranslations('claim')
    const { setClaimToMercadoPago, selectedCountry, regionalMethodType } = useClaimBankFlow()
    const [currentStep, setCurrentStep] = useState<MercadoPagoStep>(MercadoPagoStep.DETAILS)
    const router = useRouter()
    const [destinationAddress, setDestinationAddress] = useState('')
    const { canDo, isKycApproved, rails } = useCapabilities()

    // MIGRATION-REVIEW: MercadoPago/PIX claim is a `pay` operation over Manteca. Old gate was
    // `isUserMantecaKycApproved` (any MANTECA/SUMSUB-mantecaGeo verification approved). Mapped to
    // canDo('pay', { provider: 'manteca' }) — operation-specific, so a Sumsub-approved user with
    // only the pool-tier pay rail correctly passes (matching the old behavior where Sumsub-with-
    // mantecaGeo counted as approved).
    const isMantecaPayEnabled = canDo('pay', { provider: 'manteca' })

    // Use the shared rejection util so the `restart-identity` branch (Manteca
    // country-ineligibility — user uploaded a non-AR/BR doc) is honored here too.
    const mantecaRejection = useMemo(() => deriveProviderRejection(rails, 'MANTECA'), [rails])

    // inline sumsub kyc flow for manteca users who need LATAM verification
    // regionIntent is NOT passed here to avoid creating a backend record on mount.
    // intent is passed at call time: handleInitiateKyc('LATAM')
    const sumsubFlow = useMultiPhaseKycFlow({})
    const [showKycModal, setShowKycModal] = useState(false)

    const isSuccess = currentStep === MercadoPagoStep.SUCCESS
    const selectedCurrency = selectedCountry?.currency || 'ARS'
    // display-only fallback when no method is known (legacy regional-claim URL
    // without a `method` param). NEVER feed this fallback into geo decisions.
    const displayMethodType = regionalMethodType ?? 'mercadopago'
    const regionalMethodLogo = displayMethodType === 'mercadopago' ? MERCADO_PAGO : PIX
    const logo = selectedCountry?.id ? undefined : regionalMethodLogo

    // geo for the Manteca KYC action: an explicit country pick wins; otherwise
    // derive from the regional method, which is only non-null when the user
    // actually chose it (in-session tap or the `method` URL param that survives
    // the auth redirect). undefined when unknown — the BE then resolves geo
    // from the user's documents instead of trusting a wrong FE guess.
    const targetCountry =
        selectedCountry?.id ??
        (regionalMethodType === 'pix' ? 'BR' : regionalMethodType === 'mercadopago' ? 'AR' : undefined)

    // show confirmation modal if user hasn't completed manteca verification
    useEffect(() => {
        if (!isMantecaPayEnabled) {
            setShowKycModal(true)
        }
    }, [isMantecaPayEnabled])

    const renderStepDetails = () => {
        if (currentStep === MercadoPagoStep.DETAILS) {
            return (
                <MantecaDetailsStep
                    destinationAddress={destinationAddress}
                    setDestinationAddress={setDestinationAddress}
                    setCurrentStep={setCurrentStep}
                />
            )
        }
        if (currentStep === MercadoPagoStep.REVIEW) {
            return (
                <MantecaReviewStep
                    setCurrentStep={setCurrentStep}
                    claimLink={claimLinkData.link}
                    destinationAddress={destinationAddress}
                    amount={amount}
                    currency={selectedCurrency}
                />
            )
        }

        if (currentStep === MercadoPagoStep.SUCCESS) {
            return (
                <Button onClick={() => router.push('/home')} shadowSize="4">
                    {t('backToHome')}
                </Button>
            )
        }
        return null
    }

    const onPrev = () => {
        if (currentStep === MercadoPagoStep.DETAILS) {
            setClaimToMercadoPago(false)
            return
        }

        if (currentStep === MercadoPagoStep.REVIEW) {
            setCurrentStep(MercadoPagoStep.DETAILS)
            return
        }
        if (currentStep === MercadoPagoStep.SUCCESS) {
            router.push('/home')
            return
        }
    }

    return (
        <div className="flex min-h-[inherit] flex-col justify-between gap-8 md:min-h-fit">
            <NavHeader icon={isSuccess ? 'cancel' : 'chevron-up'} title={t('receive')} onPrev={onPrev} />

            <div className="my-auto space-y-4">
                <PeanutActionDetailsCard
                    viewType={isSuccess ? 'SUCCESS' : 'NORMAL'}
                    avatarSize="medium"
                    transactionType="REGIONAL_METHOD_CLAIM"
                    recipientType="USERNAME"
                    recipientName={
                        isSuccess ? t('manteca.youWillReceive') : t('manteca.receiveIn', { method: displayMethodType })
                    }
                    amount={amount}
                    tokenSymbol={claimLinkData.tokenSymbol}
                    message={attachment.message}
                    fileUrl={attachment.attachmentUrl}
                    logo={isSuccess ? undefined : logo}
                    countryCodeForFlag={selectedCountry?.id?.toLowerCase()}
                />

                {renderStepDetails()}
                {sumsubFlow.error && <ErrorAlert description={sumsubFlow.error} />}
            </div>
            <InitiateKycModal
                visible={showKycModal}
                onClose={() => setShowKycModal(false)}
                onVerify={async () => {
                    if (mantecaRejection.state === 'blocked') {
                        // blocked users cannot self-heal — route to support
                        if (typeof window !== 'undefined' && (window as any).$crisp) {
                            ;(window as any).$crisp.push(['do', 'chat:open'])
                        }
                        setShowKycModal(false)
                        return
                    }
                    if (mantecaRejection.state === 'restart-identity') {
                        await sumsubFlow.handleRestartIdentity()
                    } else if (mantecaRejection.state === 'fixable') {
                        await sumsubFlow.handleSelfHealResubmit('MANTECA')
                    } else {
                        await sumsubFlow.handleInitiateKyc('LATAM', undefined, true, targetCountry)
                    }
                    setShowKycModal(false)
                }}
                isLoading={sumsubFlow.isLoading}
                variant={
                    mantecaRejection.state === 'blocked'
                        ? 'blocked'
                        : mantecaRejection.state === 'restart-identity'
                          ? 'restart_identity'
                          : mantecaRejection.state === 'fixable'
                            ? 'provider_rejection'
                            : // MIGRATION-REVIEW: 'cross_region' copy = "you're already verified, just need
                              // the regional Manteca uplift". Old gate was `isUserSumsubKycApproved`. Sumsub has
                              // no rail in the capability model; any enabled rail implies identity verification
                              // was completed at least once, so isKycApproved is the closest faithful proxy.
                              isKycApproved
                              ? 'cross_region'
                              : 'default'
                }
                providerMessage={mantecaRejection.userMessage ?? undefined}
                regionName={selectedCountry?.title}
            />
            <SumsubKycModals flow={sumsubFlow} />
        </div>
    )
}

export default MantecaFlowManager
