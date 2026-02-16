'use client'

/**
 * wrapper component for SemanticRequestPage
 *
 * handles async url parsing before rendering the actual flow.
 * parses semantic urls like /username, /0x1234..., /vitalik.eth
 * also supports amount/token/chain in url path
 *
 * shows loading/error states while parsing
 *
 * used by: /[...recipient] route for address/ens/username payments
 */

import { SemanticRequestPage } from './SemanticRequestPage'
import { parsePaymentURL, type ParseUrlError } from '@/lib/url-parser/parser'
import PeanutLoading from '@/components/Global/PeanutLoading'
import ErrorAlert from '@/components/Global/ErrorAlert'
import NavHeader from '@/components/Global/NavHeader'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { type ParsedURL } from '@/lib/url-parser/types/payment'
import { formatAmount } from '@/utils/general.utils'

interface SemanticRequestPageWrapperProps {
    recipient: string[]
}

export function SemanticRequestPageWrapper({ recipient }: SemanticRequestPageWrapperProps) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const chargeIdFromUrl = searchParams.get('chargeId')

    const [parsedUrl, setParsedUrl] = useState<ParsedURL | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<ParseUrlError | null>(null)

    // parse the url segments
    useEffect(() => {
        if (!recipient || recipient.length === 0) {
            setError({ message: 'Invalid URL format' } as ParseUrlError)
            setIsLoading(false)
            return
        }

        // If we have a chargeId, skip URL parsing - charge will provide all needed data
        // Use a dummy parsedUrl to satisfy the component contract
        if (chargeIdFromUrl) {
            setParsedUrl({
                recipient: null, // Will be populated from charge
                amount: undefined,
                token: undefined,
                chain: undefined,
            })
            setIsLoading(false)
            return
        }

        setIsLoading(true)
        setError(null)

        parsePaymentURL(recipient)
            .then((result) => {
                if (result.error) {
                    setError(result.error)
                } else if (result.parsedUrl) {
                    // format amount if present
                    const formatted = {
                        ...result.parsedUrl,
                        amount: result.parsedUrl.amount ? formatAmount(result.parsedUrl.amount) : undefined,
                    }
                    setParsedUrl(formatted)
                }
            })
            .catch((err) => {
                console.error('failed to parse url:', err)
                setError({ message: 'Invalid URL format' } as ParseUrlError)
            })
            .finally(() => {
                setIsLoading(false)
            })
    }, [recipient, chargeIdFromUrl])

    // loading state
    if (isLoading) {
        return (
            <div className="flex min-h-[inherit] w-full flex-col gap-4">
                <NavHeader title="Pay" onPrev={() => router.back()} />
                <div className="flex flex-grow flex-col items-center justify-center gap-4 py-8">
                    <PeanutLoading />
                </div>
            </div>
        )
    }

    // error state
    if (error || !parsedUrl) {
        return (
            <div className="flex w-full flex-col gap-4">
                <NavHeader title="Pay" onPrev={() => router.back()} />
                <ErrorAlert description={error?.message || 'invalid payment url'} />
            </div>
        )
    }

    return <SemanticRequestPage parsedUrl={parsedUrl} initialChargeId={chargeIdFromUrl ?? undefined} />
}
