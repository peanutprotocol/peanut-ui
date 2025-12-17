'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { ContributePotPageWrapper } from '@/features/payments/flows/contribute-pot/ContributePotPageWrapper'
import { SemanticRequestPageWrapper } from '@/features/payments/flows/semantic-request/SemanticRequestPageWrapper'
import { isAddress } from 'viem'
import PublicProfile from '@/components/Profile/components/PublicProfile'
import { useAuth } from '@/context/authContext'

// kept for backward compatibility with old payment form
export type PaymentFlow = 'request_pay' | 'external_wallet' | 'direct_pay' | 'withdraw'

interface Props {
    recipient: string[]
}

export default function PaymentPage({ recipient }: Props) {
    const searchParams = useSearchParams()
    const router = useRouter()
    const { user } = useAuth()
    const requestId = searchParams.get('id')
    const chargeIdFromUrl = searchParams.get('chargeId')

    // request pot flow: ?id=<requestId>
    if (requestId) {
        return <ContributePotPageWrapper requestId={requestId} />
    }

    // need at least one recipient segment
    if (recipient.length === 0) {
        return null
    }

    const firstSegment = decodeURIComponent(recipient[0])
    const recipientIdentifier = firstSegment.includes('@') ? firstSegment.split('@')[0] : firstSegment
    const isAddressRecipient = isAddress(recipientIdentifier)
    const isEnsRecipient = recipientIdentifier.endsWith('.eth')

    // semantic request flow with chargeId (confirm view)
    if (chargeIdFromUrl) {
        return <SemanticRequestPageWrapper recipient={recipient} />
    }

    // semantic request for address/ens recipients
    if (isAddressRecipient || isEnsRecipient) {
        return <SemanticRequestPageWrapper recipient={recipient} />
    }

    // semantic request for username with amount or chain specified
    // handles: /<username>/<amount><token> or /<username>@<chain>/<amount><token>
    const hasAmountSegment = recipient.length > 1
    const hasChainSpecified = firstSegment.includes('@')

    if (hasAmountSegment || hasChainSpecified) {
        return <SemanticRequestPageWrapper recipient={recipient} />
    }

    // public profile for username without payment data
    // handles: /<username>
    const username = recipientIdentifier
    const handleSendClick = () => {
        router.push(`/send/${username}`)
    }

    return (
        <div className="mx-auto h-full w-full space-y-8 self-start">
            <PublicProfile username={username} isLoggedIn={!!user} onSendClick={handleSendClick} />
        </div>
    )
}
