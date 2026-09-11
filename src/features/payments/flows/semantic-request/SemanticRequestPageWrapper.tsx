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
import { chargesApi } from '@/services/charges'
import EmptyState from '@/components/Global/EmptyStates/EmptyState'
import { parsePaymentURL, type ParseUrlError } from '@/lib/url-parser/parser'
import Loading from '@/components/Global/Loading'
import NavHeader from '@/components/Global/NavHeader'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSafeBack } from '@/hooks/useSafeBack'
import { useEffect, useState } from 'react'
import { type ParsedURL } from '@/lib/url-parser/types/payment'
import { formatAmount } from '@/utils/general.utils'
import { useTranslations } from 'next-intl'

interface SemanticRequestPageWrapperProps {
    recipient: string[]
}

export function SemanticRequestPageWrapper({ recipient }: SemanticRequestPageWrapperProps) {
    const onBack = useSafeBack('/home')
    const t = useTranslations('payment')
    const searchParams = useSearchParams()
    const chargeIdFromUrl = searchParams.get('chargeId')
    const isRetiredCardPayment = searchParams.get('context') === 'card-pioneer'
    const router = useRouter()

    const [parsedUrl, setParsedUrl] = useState<ParsedURL | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<ParseUrlError | null>(null)

    // parse the url segments
    useEffect(() => {
        // Old admission links must never open a payable charge after public
        // launch — but a COMPLETED admission charge is a real payment whose
        // receipt must stay reachable. Resolve the charge first and only
        // redirect the unpaid (or unresolvable) links.
        if (isRetiredCardPayment) {
            if (!chargeIdFromUrl) {
                router.replace('/card')
                return
            }
            chargesApi
                .get(chargeIdFromUrl)
                .then((charge) => {
                    if (charge.fulfillmentPayment?.status === 'SUCCESSFUL') {
                        setParsedUrl({ recipient: null, amount: undefined, token: undefined, chain: undefined })
                        setIsLoading(false)
                    } else {
                        router.replace('/card')
                    }
                })
                .catch(() => router.replace('/card'))
            return
        }
        // if we have a chargeId, skip URL parsing — charge will provide all needed data.
        // check this before recipient validation so /pay-request?chargeId=X works with empty recipient.
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

        if (!recipient || recipient.length === 0) {
            setError({ message: t('errors.invalidUrlFormat') } as ParseUrlError)
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
                setError({ message: t('errors.invalidUrlFormat') } as ParseUrlError)
            })
            .finally(() => {
                setIsLoading(false)
            })
    }, [recipient, chargeIdFromUrl, isRetiredCardPayment, router, t])

    // loading state — retired admission links stay here while the charge
    // resolves (paid → receipt below) or the redirect to /card lands, because
    // isLoading only clears on the paid branch.
    if (isLoading) {
        return (
            <div className="flex min-h-inherit w-full flex-col gap-4">
                <NavHeader title={t('headers.pay')} onPrev={onBack} />
                <div className="flex flex-grow flex-col items-center justify-center gap-4 py-8">
                    <Loading variant="mascot" />
                </div>
            </div>
        )
    }

    // error state — centered card (ruled 2026-09-03: no more lone top banner)
    if (error || !parsedUrl) {
        return (
            <div className="flex min-h-inherit w-full flex-col gap-4">
                <NavHeader title={t('headers.pay')} onPrev={onBack} />
                <div className="flex flex-grow flex-col justify-center py-8">
                    <EmptyState
                        icon="link"
                        title={t('errors.invalidPaymentUrlTitle')}
                        description={error?.message || t('errors.invalidPaymentUrlDescription')}
                    />
                </div>
            </div>
        )
    }

    return <SemanticRequestPage parsedUrl={parsedUrl} initialChargeId={chargeIdFromUrl ?? undefined} />
}
