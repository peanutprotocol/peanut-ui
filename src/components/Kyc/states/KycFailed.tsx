import { Button } from '@/components/0_Bruddle/Button'
import { PaymentInfoRow } from '@/components/Payment/PaymentInfoRow'
import { KYCStatusDrawerItem } from '../KYCStatusDrawerItem'
import { KycFailedContent } from '../KycFailedContent'
import Card from '@/components/Global/Card'
import { useMemo } from 'react'
import { formatDate } from '@/utils/general.utils'
import { CountryRegionRow } from '../CountryRegionRow'
import { isTerminalRejection } from '@/constants/sumsub-reject-labels.consts'
import { useModalsContext } from '@/context/ModalsContext'

// this component shows the kyc status when it's failed/rejected.
// for sumsub: maps reject labels to human-readable reasons, handles terminal vs retryable states.
// for bridge: shows raw reason string as before.
export const KycFailed = ({
    rejectLabels,
    bridgeReason,
    isSumsub,
    rejectType,
    failureCount,
    bridgeKycRejectedAt,
    countryCode,
    isBridge,
    onRetry,
    isLoading,
}: {
    rejectLabels?: string[] | null
    bridgeReason?: string | null
    isSumsub?: boolean
    rejectType?: 'RETRY' | 'FINAL' | null
    failureCount?: number
    bridgeKycRejectedAt?: string
    countryCode?: string | null
    isBridge?: boolean
    onRetry: () => void
    isLoading?: boolean
}) => {
    const { setIsSupportModalOpen } = useModalsContext()

    const rejectedOn = useMemo(() => {
        if (!bridgeKycRejectedAt) return 'N/A'
        try {
            return formatDate(new Date(bridgeKycRejectedAt))
        } catch (error) {
            console.error('failed to parse bridgeKycRejectedAt date:', error)
            return 'N/A'
        }
    }, [bridgeKycRejectedAt])

    // only sumsub verifications can be terminal — bridge rejections always allow retry
    const isTerminal = useMemo(
        () => (isSumsub ? isTerminalRejection({ rejectType, failureCount, rejectLabels }) : false),
        [isSumsub, rejectType, failureCount, rejectLabels]
    )

    // determine which row is last in the card for border handling
    const hasCountryRow = isBridge || !!countryCode
    const hasReasonRow = !isSumsub

    return (
        <div className="space-y-4">
            <KYCStatusDrawerItem status="failed" />

            <Card position="single" className="py-0">
                <PaymentInfoRow
                    label="Rejected on"
                    value={rejectedOn}
                    hideBottomBorder={!hasCountryRow && !hasReasonRow}
                />
                <CountryRegionRow countryCode={countryCode} isBridge={isBridge} hideBottomBorder={!hasReasonRow} />
                {hasReasonRow && (
                    <PaymentInfoRow
                        label="Reason"
                        value={bridgeReason || 'There was an issue. Contact Support.'}
                        hideBottomBorder
                    />
                )}
            </Card>

            {isSumsub && <KycFailedContent rejectLabels={rejectLabels} isTerminal={isTerminal} />}

            {isTerminal ? (
                <div className="p-1">
                    {/* TODO: auto-create crisp support ticket on terminal rejection */}
                    <Button
                        variant="purple"
                        className="w-full"
                        shadowSize="4"
                        onClick={() => setIsSupportModalOpen(true)}
                    >
                        Contact support
                    </Button>
                </div>
            ) : (
                <Button
                    icon="retry"
                    variant="purple"
                    className="w-full"
                    shadowSize="4"
                    onClick={onRetry}
                    disabled={isLoading}
                >
                    {isLoading ? 'Loading...' : 'Retry verification'}
                </Button>
            )}
        </div>
    )
}
