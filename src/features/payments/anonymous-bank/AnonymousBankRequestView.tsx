'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { Section } from '@/components/0_Bruddle/Section'
import Loading from '@/components/Global/Loading'
import NavHeader from '@/components/Global/NavHeader'
import { ContributePotPageWrapper } from '@/features/payments/flows/contribute-pot/ContributePotPageWrapper'
import { useRequestDepositInstructions } from '@/features/deposit-accounts/useRequestDepositInstructions'
import { isUsdPeggedRequest } from '@/features/deposit-accounts/payerAmount'
import { useSafeBack } from '@/hooks/useSafeBack'
import { requestsApi } from '@/services/requests'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { CurrencyBankOption } from './CurrencyBankOption'

/**
 * What a signed-out payer of a request sees FIRST, when the requester opted the
 * request into bank payment.
 *
 * The individuals Peanut serves on GBP/COP/BRL/EUR are business-only, so the
 * payer of a bank-payable request is most often a business that is not a Peanut
 * user. It opens the link, recognises its own currency, and pays from its bank
 * — no account, no login. So the bank option leads here, currency-first,
 * instead of sitting under the wallet options a signed-out visitor cannot use.
 *
 * Everything else is unchanged. A request that did not opt in — the backend
 * answers 404, `isUnavailable` — and any payer who would rather use a wallet or
 * card both land on the normal `ContributePotPageWrapper`, which still carries
 * its own bank row for a signed-in payer.
 */
export function AnonymousBankRequestView({ requestId }: { requestId: string }) {
    const t = useTranslations('payment')
    const onBack = useSafeBack('/home')
    const [showOtherWays, setShowOtherWays] = useState(false)

    // The server decides payer access: the deposit-instructions endpoint checks
    // the request's OWN opt-in flag and answers 404 (isUnavailable) when the
    // requester did not opt in. The read is NOT gated on the payer's own rollout
    // cohort — doing so re-evaluated the flag in the payer's browser and dropped
    // an out-of-cohort payer out of a request the requester opted into. The
    // rollout flag gates CREATION only.
    const {
        instructions,
        isLoading: isLoadingInstructions,
        isUnavailable,
    } = useRequestDepositInstructions(requestId, true)
    // Only for the amount to send. The request read is public (optional auth),
    // so a signed-out payer gets the figure the request asks for.
    const requestQuery = useQuery({
        queryKey: ['anonymous-bank-request', requestId],
        queryFn: () => requestsApi.get(requestId),
    })

    if (isLoadingInstructions || requestQuery.isLoading) {
        return (
            <div className="flex min-h-inherit w-full flex-col gap-4">
                <NavHeader title={t('headers.pay')} onPrev={onBack} />
                <div className="flex flex-grow flex-col items-center justify-center gap-4 py-8">
                    <Loading variant="mascot" />
                </div>
            </div>
        )
    }

    // Not opted in (404), retired since the link went out, the payer chose
    // another way, OR the request read failed — the normal flow owns all of
    // these. A failed request read means no trustworthy amount, so the bank
    // view is withheld rather than shown without one; the normal flow does its
    // own request load and shows the right error for a request that will not load.
    if (isUnavailable || requestQuery.isError || !instructions || showOtherWays) {
        return <ContributePotPageWrapper requestId={requestId} />
    }

    return (
        <div className="flex min-h-inherit w-full flex-col gap-4">
            <NavHeader title={t('headers.pay')} onPrev={onBack} />
            <PageStack.Center className="gap-6">
                <Section title={t('bankTransfer.title')}>
                    <CurrencyBankOption
                        instructions={instructions}
                        // Only a dollar-denominated request has an amount the payer
                        // conversion can trust; otherwise show the details without a
                        // wrongly-converted figure.
                        usdAmount={
                            isUsdPeggedRequest(requestQuery.data?.tokenSymbol)
                                ? requestQuery.data?.tokenAmount
                                : undefined
                        }
                    />
                </Section>
                <Button variant="transparent" size="small" onClick={() => setShowOtherWays(true)}>
                    {t('bankTransfer.otherWays')}
                </Button>
            </PageStack.Center>
        </div>
    )
}
