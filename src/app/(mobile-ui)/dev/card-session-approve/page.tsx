'use client'

/**
 * Dev page: grant the combined session-key permission for a Rain card.
 *
 * Delegates to `useGrantSessionKey`, which also powers the production
 * flow (inline prompt in `useSpendBundle`, card-activation UX later).
 * Kept untracked — just a trigger surface while we build the real UI.
 */

import { useState } from 'react'
import { findActiveCard } from '@/components/Card/cardState.utils'
import { useRainCardOverview } from '@/hooks/useRainCardOverview'
import { useGrantSessionKey } from '@/hooks/wallet/useGrantSessionKey'
import { Button } from '@/components/0_Bruddle/Button'
import { Card } from '@/components/0_Bruddle/Card'
import { DataRow } from '@/components/0_Bruddle/DataRow'
import { Notification } from '@/components/0_Bruddle/Notification'
import DevPageShell from '../_components/DevPageShell'

export default function CardSessionApprovePage() {
    const { overview } = useRainCardOverview()
    const { grant, isGranting } = useGrantSessionKey()
    const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null)

    const card = findActiveCard(overview)

    const handleClick = async () => {
        setStatus(null)
        const result = await grant()
        if (result.ok) {
            setStatus({ ok: true, message: 'Granted. The overview now shows hasWithdrawApproval=true.' })
        } else {
            setStatus({
                ok: false,
                message: `${result.error.kind}${'message' in result.error ? `: ${result.error.message}` : ''}`,
            })
        }
    }

    return (
        <DevPageShell
            title="Rain card — grant session-key permission"
            description="One passkey tap installs both auto-balancer and withdraw policies to your kernel. After this grant, card collateral spends only need a single admin EIP-712 tap per spend."
            width="prose"
        >
            <Card className="divide-y divide-dashed divide-border-default px-4">
                <DataRow label="Card status" value={card?.status ?? 'no card'} />
                <DataRow label="Collateral proxy" value={overview?.status?.contractAddress ?? '—'} />
                <DataRow label="Coordinator" value={overview?.status?.coordinatorAddress ?? '—'} />
                <DataRow label="Withdraw approval" value={card?.hasWithdrawApproval ? 'true' : 'false'} />
            </Card>

            <Button
                variant="purple"
                className="w-full"
                onClick={handleClick}
                disabled={isGranting || !card}
                loading={isGranting}
            >
                Grant permission (one tap)
            </Button>

            {status && <Notification priority={status.ok ? 'success' : 'error'}>{status.message}</Notification>}
        </DevPageShell>
    )
}
