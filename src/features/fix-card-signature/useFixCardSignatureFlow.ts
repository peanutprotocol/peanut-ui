'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { findActiveCard } from '@/components/Card/cardState.utils'
import { useRainCardOverview } from '@/hooks/useRainCardOverview'
import { useZeroDev } from '@/hooks/useZeroDev'
import { useCardSignatureRepair } from '@/hooks/wallet/useCardSignatureRepair'
import { useGrantSessionKey } from '@/hooks/wallet/useGrantSessionKey'

/**
 * flow hook for the /fix-card-signature support page — owns the two-step
 * repair (fix wallet state, then re-grant auto-funding) so the page stays dumb.
 */
export function useFixCardSignatureFlow() {
    const t = useTranslations('card')
    const { address } = useZeroDev()
    const { overview, isLoading: isOverviewLoading } = useRainCardOverview()
    const { diagnosis, isDiagnosing, isRepairing, error, diagnose, repair } = useCardSignatureRepair()
    const { grant, isGranting } = useGrantSessionKey()
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
    const busy = isDiagnosing || isRepairing || isGranting

    const handleRepair = async () => {
        setGrantErrorMessage(null)
        await repair()
    }

    const handleGrant = async () => {
        setGrantErrorMessage(null)
        const result = await grant()
        if (result.ok) {
            setGrantDone(true)
        } else if (result.error.kind !== 'user-cancelled') {
            setGrantErrorMessage(
                result.error.kind === 'no-card' ? t('fixSignature.noActiveCard') : t('fixSignature.regrantFailed')
            )
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
        isGranting,
        grantDone,
        grantErrorMessage,
        needsRepair,
        busy,
        handleRepair,
        handleGrant,
    }
}
