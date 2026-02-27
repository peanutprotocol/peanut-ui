import { KycActionRequired } from './states/KycActionRequired'
import { KycCompleted } from './states/KycCompleted'
import { KycFailed } from './states/KycFailed'
import { KycNotStarted } from './states/KycNotStarted'
import { KycProcessing } from './states/KycProcessing'
import { KycRequiresDocuments } from './states/KycRequiresDocuments'
import { SumsubKycModals } from '@/components/Kyc/SumsubKycModals'
import { Drawer, DrawerContent, DrawerTitle } from '../Global/Drawer'
import { type BridgeKycStatus } from '@/utils/bridge-accounts.utils'
import { type IUserKycVerification } from '@/interfaces'
import { useUserStore } from '@/redux/hooks'
import { useMultiPhaseKycFlow } from '@/hooks/useMultiPhaseKycFlow'
import { getKycStatusCategory, isKycStatusNotStarted } from '@/constants/kyc.consts'
import { type KYCRegionIntent } from '@/app/actions/types/sumsub.types'

interface KycStatusDrawerProps {
    isOpen: boolean
    onClose: () => void
    verification?: IUserKycVerification
    bridgeKycStatus?: BridgeKycStatus
    region?: 'STANDARD' | 'LATAM'
}

// this component determines which kyc state to show inside the drawer and fetches rejection reasons if the kyc has failed.
export const KycStatusDrawer = ({ isOpen, onClose, verification, bridgeKycStatus, region }: KycStatusDrawerProps) => {
    const { user } = useUserStore()

    const status = verification ? verification.status : bridgeKycStatus
    const statusCategory = status ? getKycStatusCategory(status) : undefined
    const countryCode = verification ? verification.mantecaGeo || verification.bridgeGeo : null
    const isBridgeKyc = !verification && !!bridgeKycStatus
    const provider = verification ? verification.provider : 'BRIDGE'
    // derive region intent from sumsub verification metadata so token uses correct level
    const sumsubRegionIntent = (
        verification?.provider === 'SUMSUB' ? verification?.metadata?.regionIntent : undefined
    ) as KYCRegionIntent | undefined

    const sumsubFlow = useMultiPhaseKycFlow({
        onKycSuccess: onClose,
        onManualClose: onClose,
        // don't pass regionIntent for completed kyc — prevents the mount effect
        // in useSumsubKycFlow from calling initiateSumsubKyc(), which triggers
        // the undefined->APPROVED transition that auto-closes the drawer
        regionIntent: statusCategory === 'completed' ? undefined : sumsubRegionIntent,
    })

    // all kyc retries now go through sumsub
    const onRetry = async () => {
        await sumsubFlow.handleInitiateKyc()
    }

    // check if any bridge rail needs additional documents
    const bridgeRailsNeedingDocs = (user?.rails ?? []).filter(
        (r) => r.status === 'REQUIRES_EXTRA_INFORMATION' && r.rail.provider.code === 'BRIDGE'
    )
    const needsAdditionalDocs = bridgeRailsNeedingDocs.length > 0
    // aggregate requirements across all rails and deduplicate
    const additionalRequirements: string[] = needsAdditionalDocs
        ? [
              ...new Set(
                  bridgeRailsNeedingDocs.flatMap((r) => {
                      const reqs = r.metadata?.additionalRequirements
                      return Array.isArray(reqs) ? reqs : []
                  })
              ),
          ]
        : []

    // count sumsub rejections for failure lockout.
    const sumsubFailureCount =
        user?.user?.kycVerifications?.filter((v) => v.provider === 'SUMSUB' && v.status === 'REJECTED').length ?? 0

    const handleSubmitAdditionalDocs = async () => {
        await sumsubFlow.handleInitiateKyc(undefined, 'peanut-additional-docs')
    }

    const renderContent = () => {
        // user initiated kyc but abandoned before submitting — show resume cta
        if (verification && isKycStatusNotStarted(status)) {
            return <KycNotStarted onResume={onRetry} isLoading={sumsubFlow.isLoading} />
        }

        // bridge additional document requirement — but don't mask terminal kyc states
        if (needsAdditionalDocs && statusCategory !== 'failed' && statusCategory !== 'action_required') {
            return (
                <KycRequiresDocuments
                    requirements={additionalRequirements}
                    onSubmitDocuments={handleSubmitAdditionalDocs}
                    isLoading={sumsubFlow.isLoading}
                />
            )
        }

        switch (statusCategory) {
            case 'processing':
                return (
                    <KycProcessing
                        bridgeKycStartedAt={verification?.createdAt ?? user?.user?.bridgeKycStartedAt}
                        countryCode={countryCode ?? undefined}
                        isBridge={isBridgeKyc}
                    />
                )
            case 'completed':
                return (
                    <KycCompleted
                        bridgeKycApprovedAt={verification?.approvedAt ?? user?.user?.bridgeKycApprovedAt}
                        countryCode={countryCode ?? undefined}
                        isBridge={isBridgeKyc || region === 'STANDARD'}
                        rails={user?.rails?.filter((r) => {
                            if (region === 'STANDARD') return r.rail.provider.code === 'BRIDGE'
                            if (region === 'LATAM') return r.rail.provider.code === 'MANTECA'
                            return true
                        })}
                    />
                )
            case 'action_required':
                return (
                    <KycActionRequired
                        onResume={onRetry}
                        isLoading={sumsubFlow.isLoading}
                        rejectLabels={verification?.rejectLabels}
                    />
                )
            case 'failed':
                return (
                    <KycFailed
                        rejectLabels={verification?.rejectLabels}
                        bridgeReason={user?.user?.bridgeKycRejectionReasonString}
                        isSumsub={provider === 'SUMSUB'}
                        rejectType={verification?.rejectType}
                        failureCount={sumsubFailureCount}
                        bridgeKycRejectedAt={verification?.updatedAt ?? user?.user?.bridgeKycRejectedAt}
                        countryCode={countryCode ?? undefined}
                        isBridge={isBridgeKyc}
                        onRetry={onRetry}
                        isLoading={sumsubFlow.isLoading}
                    />
                )
            default:
                return null
        }
    }

    // don't render the drawer if the kyc status is unknown or not started.
    // if a verification record exists, the user has initiated KYC — show the drawer.
    if (!verification && isKycStatusNotStarted(status)) {
        return null
    }

    return (
        <>
            <Drawer open={isOpen} onOpenChange={onClose}>
                <DrawerContent className="p-5 pb-12">
                    <DrawerTitle className="sr-only">KYC Status</DrawerTitle>
                    {renderContent()}
                    {sumsubFlow.error && provider === 'SUMSUB' && (
                        <p className="text-red-500 mt-3 text-center text-sm">{sumsubFlow.error}</p>
                    )}
                </DrawerContent>
            </Drawer>
            <SumsubKycModals flow={sumsubFlow} autoStartSdk />
        </>
    )
}
