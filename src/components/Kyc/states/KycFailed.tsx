import { Button } from '@/components/0_Bruddle/Button'
import { PaymentInfoRow } from '@/components/Payment/PaymentInfoRow'
import { KYCStatusDrawerItem } from '../KYCStatusDrawerItem'
import Card from '@/components/Global/Card'
import InfoCard from '@/components/Global/InfoCard'
import { useMemo } from 'react'
import { formatDate } from '@/utils/general.utils'
import { CountryRegionRow } from '../CountryRegionRow'
import { getRejectLabelInfo, hasTerminalRejectLabel } from '@/constants/sumsub-reject-labels.consts'
import { useModalsContext } from '@/context/ModalsContext'

const MAX_RETRY_COUNT = 2

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

    // determine if this is a terminal (permanent) rejection
    const isTerminal = useMemo(() => {
        if (rejectType === 'FINAL') return true
        if (failureCount && failureCount >= MAX_RETRY_COUNT) return true
        if (rejectLabels?.length && hasTerminalRejectLabel(rejectLabels)) return true
        return false
    }, [rejectType, failureCount, rejectLabels])

    // map sumsub labels to human-readable items for InfoCard
    const reasonItems = useMemo(() => {
        if (!isSumsub || !rejectLabels?.length) return null
        return rejectLabels.map((label) => {
            const info = getRejectLabelInfo(label)
            return (
                <span key={label}>
                    <strong>{info.title}:</strong> {info.description}
                </span>
            )
        })
    }, [isSumsub, rejectLabels])

    // formatted bridge reason (legacy display)
    const formattedBridgeReason = useMemo(() => {
        const reasonText = bridgeReason || 'There was an issue. Contact Support.'
        const lines = reasonText.split(/\\n|\n/).filter((line) => line.trim() !== '')
        if (lines.length === 1) return reasonText
        return (
            <ul className="list-disc space-y-1 pl-4">
                {lines.map((line, index) => (
                    <li key={index}>{line}</li>
                ))}
            </ul>
        )
    }, [bridgeReason])

    return (
        <div className="space-y-4">
            <KYCStatusDrawerItem status="failed" />

            <Card position="single">
                <PaymentInfoRow label="Rejected on" value={rejectedOn} />
                <CountryRegionRow countryCode={countryCode} isBridge={isBridge} />
                {!isSumsub && <PaymentInfoRow label="Reason" value={formattedBridgeReason} hideBottomBorder />}
            </Card>

            {isSumsub && reasonItems && (
                <InfoCard variant="error" icon="alert" title="Why your verification was rejected" items={reasonItems} />
            )}

            {isTerminal ? (
                <div className="space-y-3">
                    <InfoCard
                        variant="error"
                        icon="lock"
                        description="Your verification cannot be retried. Please contact support for help."
                    />
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
