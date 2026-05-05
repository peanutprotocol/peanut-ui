'use client'

/**
 * Dev page: grant the combined session-key permission for a Rain card.
 *
 * Delegates to `useGrantSessionKey`, which also powers the production
 * flow (inline prompt in `useSpendBundle`, card-activation UX later).
 * Kept untracked — just a trigger surface while we build the real UI.
 */

import { useState } from 'react'
import { useRainCardOverview } from '@/hooks/useRainCardOverview'
import { useGrantSessionKey } from '@/hooks/wallet/useGrantSessionKey'
import { Button } from '@/components/0_Bruddle/Button'

export default function CardSessionApprovePage() {
    const { overview } = useRainCardOverview()
    const { grant, isGranting } = useGrantSessionKey()
    const [status, setStatus] = useState<string>('')

    const card = overview?.cards?.[0]

    const handleClick = async () => {
        setStatus('Waiting for passkey tap…')
        const result = await grant()
        if (result.ok) {
            setStatus('✅ Granted — overview now shows hasWithdrawApproval=true')
        } else {
            setStatus(`❌ ${result.error.kind}${'message' in result.error ? ': ' + result.error.message : ''}`)
        }
    }

    return (
        <div className="mx-auto flex max-w-xl flex-col gap-4 p-6">
            <h1 className="text-2xl font-black">Rain card — grant session-key permission</h1>
            <p className="text-sm text-grey-1">
                One passkey tap installs both auto-balancer and withdraw policies to your kernel. After this grant, card
                collateral spends only need a single admin EIP-712 tap per spend.
            </p>

            <div className="rounded-sm border border-n-1 p-3 text-sm">
                <div>
                    <span className="font-bold">Card status: </span>
                    {card ? card.status : 'no card'}
                </div>
                <div>
                    <span className="font-bold">Collateral proxy: </span>
                    {overview?.status?.contractAddress ?? '—'}
                </div>
                <div>
                    <span className="font-bold">Coordinator: </span>
                    {overview?.status?.coordinatorAddress ?? '—'}
                </div>
                <div>
                    <span className="font-bold">hasWithdrawApproval: </span>
                    {card?.hasWithdrawApproval ? '✅ true' : '❌ false'}
                </div>
            </div>

            <Button
                variant="purple"
                shadowSize="4"
                className="w-full"
                onClick={handleClick}
                disabled={isGranting || !card}
            >
                {isGranting ? 'Working…' : 'Grant permission (one tap)'}
            </Button>

            {status && <pre className="whitespace-pre-wrap rounded-sm border border-n-1 p-3 text-xs">{status}</pre>}
        </div>
    )
}
