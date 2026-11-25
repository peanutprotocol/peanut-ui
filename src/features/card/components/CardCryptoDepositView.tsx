'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/0_Bruddle/Button'
import { Callout } from '@/components/0_Bruddle/Callout'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { TitleBlock } from '@/components/0_Bruddle/TitleBlock'
import ChainChip from '@/components/AddMoney/components/ChainChip'
import { useCryptoDepositPolling } from '@/components/AddMoney/hooks/useCryptoDepositPolling'
import Card from '@/components/Global/Card'
import CopyField from '@/components/Global/CopyField'
import Loading from '@/components/Global/Loading'
import ProcessingScreen from '@/components/Global/ProcessingScreen'
import QRCodeWrapper from '@/components/Global/QRCodeWrapper'
import { CHAIN_LOGOS, NETWORK_LABELS, SUPPORTED_EVM_CHAINS, getSupportedTokens } from '@/constants/rhino.consts'
import { useAuth } from '@/context/authContext'
import { cardCryptoAskUsd } from '@/features/card/cardAddMoney'
import { RAIN_CARD_OVERVIEW_QUERY_KEY } from '@/hooks/useRainCardOverview'
import { useWallet } from '@/hooks/wallet/useWallet'
import { rhinoApi } from '@/services/rhino'
import type { RhinoChainType } from '@/services/services.types'
import { formatBankAmount } from '@/utils/currency'

const usd = (amount: number) => formatBankAmount(amount, 'USD')

/**
 * The deposit address for one network, asking for the card gap (RhinoDepositView's states, sized for
 * the drawer). A deposit refreshes the balance and the card overview at once, so the funding step
 * sees the minimum reached and closes the drawer.
 */
export function CardCryptoDepositView({ network, gapUsd }: { network: RhinoChainType; gapUsd: number | undefined }) {
    const t = useTranslations('card.addMoney')
    const tCrypto = useTranslations('addMoney.crypto')
    const tAddMoney = useTranslations('addMoney')
    const tPayment = useTranslations('payment')
    const tCommon = useTranslations('common')
    const queryClient = useQueryClient()
    const { user } = useAuth()
    const userId = user?.user.userId
    const { address } = useWallet()
    const networkLabel = NETWORK_LABELS[network]

    // the same query the add-money crypto page reads, so the address is fetched once per network
    const { data, isLoading, isError, refetch } = useQuery({
        queryKey: ['rhino-deposit-address', userId, address, network],
        queryFn: () => rhinoApi.createDepositAddress(address as string, network, userId as string),
        enabled: !!userId && !!address,
        staleTime: 1000 * 60 * 60 * 24,
    })
    const ask = data && gapUsd ? cardCryptoAskUsd(gapUsd, data.minDepositLimitUsd) : undefined
    const askRef = useRef(ask?.askUsd)
    askRef.current = ask?.askUsd

    const [shortDeposit, setShortDeposit] = useState<{ received: number; asked: number }>()
    // the gap when a full deposit was reported: processing lasts until the balance read moves past it
    const [creditedAtGap, setCreditedAtGap] = useState<number>()
    const gapRef = useRef(gapUsd)
    gapRef.current = gapUsd
    const handleSuccess = useCallback(
        (amount: number) => {
            void queryClient.invalidateQueries({ queryKey: ['balance'] })
            void queryClient.invalidateQueries({ queryKey: [RAIN_CARD_OVERVIEW_QUERY_KEY] })
            const asked = askRef.current
            if (asked !== undefined && amount < asked) setShortDeposit({ received: amount, asked })
            else setCreditedAtGap(gapRef.current ?? 0)
        },
        [queryClient]
    )
    // a full deposit that still leaves a gap (a fee taken on the way) is a short one: the step names
    // the new gap instead of waiting on a close that never comes
    useEffect(() => {
        if (creditedAtGap === undefined || gapUsd === undefined || gapUsd === creditedAtGap || gapUsd <= 0) return
        setShortDeposit({ received: creditedAtGap - gapUsd, asked: creditedAtGap })
        setCreditedAtGap(undefined)
    }, [creditedAtGap, gapUsd])
    const credited = creditedAtGap !== undefined
    const { status, resetStatus, isResetting } = useCryptoDepositPolling(data?.depositAddress, handleSuccess)

    // Rhino reports one deposit per address until the status is cleared: after a short deposit the
    // clear re-arms the poll for the rest, as RhinoDepositView does
    useEffect(() => {
        if (!shortDeposit) return
        resetStatus().catch(() => {
            // the next transfer still books on the backend; the balance poll shows it
        })
    }, [shortDeposit, resetStatus])

    if (status === 'failed') {
        return (
            <div className="flex flex-col items-center gap-4">
                <Card>
                    <div className="flex w-full flex-col items-center gap-2 text-center">
                        <IconBubble icon="alert" size="s" color="yellow" />
                        <h2 className="text-heading-card text-foreground-primary">{tCrypto('marketMovedTitle')}</h2>
                        <p className="text-body-s text-foreground-secondary">{tCrypto('marketMovedDescription')}</p>
                        <p className="text-label-l text-foreground-secondary">{tCrypto('marketMovedNote')}</p>
                    </div>
                </Card>
                <Button
                    variant="primary"
                    className="w-full"
                    onClick={() => void resetStatus()}
                    loading={isResetting}
                    disabled={isResetting}
                >
                    {tCommon('tryAgain')}
                </Button>
            </div>
        )
    }

    // detected and settling, or credited while the balance read catches up: no second deposit invited
    if (status === 'loading' || credited) {
        return (
            <div className="py-6" data-testid="card-add-money-processing">
                <ProcessingScreen
                    title={tAddMoney('processingDepositTitle')}
                    description={tAddMoney('processingDepositBody')}
                />
            </div>
        )
    }

    if (isLoading) {
        return (
            <div className="flex justify-center py-10">
                <Loading variant="mascot" />
            </div>
        )
    }

    if (isError || !data) {
        return (
            <div className="flex flex-col items-center gap-4 text-center">
                <IconBubble icon="alert" color="red" />
                <TitleBlock
                    align="center"
                    size="s"
                    title={tCrypto('addressErrorTitle')}
                    description={tCrypto('addressErrorDescription')}
                />
                <Button variant="primary" className="w-full" onClick={() => void refetch()}>
                    {tCommon('retry')}
                </Button>
            </div>
        )
    }

    return (
        <div className="flex flex-col items-center gap-4" data-testid="card-add-money-address">
            {shortDeposit && (
                <Card data-testid="card-add-money-short">
                    <div className="flex w-full flex-col items-center gap-2 text-center">
                        <IconBubble icon="alert" size="s" color="yellow" />
                        <h2 className="text-heading-card text-foreground-primary">
                            {tPayment('partialContribution.title', {
                                received: usd(shortDeposit.received),
                                asked: usd(shortDeposit.asked),
                            })}
                        </h2>
                        <p className="text-body-s text-foreground-secondary">
                            {tPayment('partialContribution.description', {
                                // never below the network minimum: Rhino would not bridge a smaller rest
                                remaining: usd(
                                    cardCryptoAskUsd(
                                        Math.max(shortDeposit.asked - shortDeposit.received, 0.01),
                                        data.minDepositLimitUsd
                                    ).askUsd
                                ),
                            })}
                        </p>
                    </div>
                </Card>
            )}
            <p className="text-body-m text-foreground-primary">{t('depositAddress', { network: networkLabel })}</p>
            <QRCodeWrapper url={data.depositAddress} />
            <CopyField text={data.depositAddress} />
            <Callout priority="attention" title={t('networkOnlyTitle', { network: networkLabel })}>
                <div className="flex flex-col gap-2">
                    <p>{tCrypto('warningDescription')}</p>
                    <div className="flex flex-wrap items-center gap-2">
                        <p>{tCrypto('supportedTokensInline')}</p>
                        {getSupportedTokens(network).map((token) => (
                            <ChainChip key={token.name} chainName={token.name} chainSymbol={token.logoUrl} />
                        ))}
                    </div>
                </div>
            </Callout>
            {network === 'EVM' && (
                <Card className="flex flex-col gap-2 p-4">
                    <h3 className="text-label-l text-foreground-primary">{tCrypto('supportedEvmNetworks')}</h3>
                    <div className="flex flex-wrap gap-2">
                        {SUPPORTED_EVM_CHAINS.map((chain) => (
                            <ChainChip key={chain} chainName={chain} chainSymbol={CHAIN_LOGOS[chain]} />
                        ))}
                    </div>
                </Card>
            )}
            {ask && (
                <div className="flex w-full flex-col gap-1" data-testid="card-add-money-ask">
                    <p className="text-body-m-semibold text-foreground-primary">
                        {t('sendAsk', { amount: usd(ask.askUsd) })}
                    </p>
                    {ask.raisedToMinimum && gapUsd && (
                        <p className="text-body-s text-foreground-secondary">
                            {t('raisedToMinimum', {
                                network: networkLabel,
                                minimum: usd(ask.askUsd),
                                extra: usd(ask.askUsd - gapUsd),
                            })}
                        </p>
                    )}
                    <p className="text-body-s text-foreground-secondary">{tCrypto('sendExtraForFees')}</p>
                </div>
            )}
            <div className="flex items-center gap-2 text-body-s text-foreground-secondary">
                <Loading />
                <span>{t('waiting')}</span>
            </div>
        </div>
    )
}
