'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { findActiveCard } from '@/components/Card/cardState.utils'
import { useRainCardOverview } from '@/hooks/useRainCardOverview'
import { useZeroDev } from '@/hooks/useZeroDev'
import { useCardSignatureRepair } from '@/hooks/wallet/useCardSignatureRepair'
import { useGrantSessionKey } from '@/hooks/wallet/useGrantSessionKey'
import { useRainFunding } from '@/hooks/wallet/useRainFunding'

/**
 * flow hook for the /fix-card-signature support page — owns the repair (fix
 * wallet state, then restore the two card permissions) so the page stays dumb.
 *
 * The two permissions are different things and both must hold before the page
 * says "all set": the session-key grant only lets collateral WITHDRAWALS work
 * again; the card is funded by Rain's operator allowance (useRainFunding).
 */
export function useFixCardSignatureFlow() {
    const t = useTranslations('card')
    const { address } = useZeroDev()
    const { overview, isLoading: isOverviewLoading } = useRainCardOverview()
    const { diagnosis, isDiagnosing, isRepairing, error, diagnose, repair } = useCardSignatureRepair()
    const { grant, isGranting } = useGrantSessionKey()
    // Approve-only: the fresh read inside `approve` makes it a no-op when the
    // wallet already approved Rain.
    const { approve: approveFunding, isSubmitting: isApprovingFunding } = useRainFunding({ enabled: false })
    const [withdrawalsRepaired, setWithdrawalsRepaired] = useState(false)
    const [grantDone, setGrantDone] = useState(false)
    const [grantErrorMessage, setGrantErrorMessage] = useState<string | null>(null)

    const card = findActiveCard(overview)

    // Keyed on address: the zerodev address hydrates asynchronously after the
    // layout unblocks, so a mount-only effect would diagnose before it exists
    // and never retry — dead page on a cold load from a support DM.
    useEffect(() => {
        if (address) void diagnose()
    }, [address, diagnose])

    const needsRepair = diagnosis !== null && diagnosis.state !== 'healthy'
    const isRestoring = isGranting || isApprovingFunding
    const busy = isDiagnosing || isRepairing || isRestoring

    const handleRepair = async () => {
        setGrantErrorMessage(null)
        await repair()
    }

    const handleGrant = async () => {
        setGrantErrorMessage(null)
        // A retry after a failed funding approval must not re-sign the
        // withdrawal permission that already landed.
        if (!withdrawalsRepaired) {
            const result = await grant()
            if (!result.ok) {
                if (result.error.kind !== 'user-cancelled') {
                    setGrantErrorMessage(
                        result.error.kind === 'no-card'
                            ? t('fixSignature.noActiveCard')
                            : t('fixSignature.regrantFailed')
                    )
                }
                return
            }
            setWithdrawalsRepaired(true)
        }

        const funded = await approveFunding()
        if (funded.ok) {
            setGrantDone(true)
        } else if (funded.error.kind !== 'user-cancelled') {
            setGrantErrorMessage(t('fixSignature.fundingFailed'))
        }
    }

    return {
        address,
        card,
        isOverviewLoading,
        diagnosis,
        isDiagnosing,
        isRepairing,
        error,
        diagnose,
        isGranting: isRestoring,
        withdrawalsRepaired,
        grantDone,
        grantErrorMessage,
        needsRepair,
        busy,
        handleRepair,
        handleGrant,
    }
}
