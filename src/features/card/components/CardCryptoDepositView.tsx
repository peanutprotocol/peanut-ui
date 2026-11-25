'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/0_Bruddle/Button'
import { Callout } from '@/components/0_Bruddle/Callout'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { TitleBlock } from '@/components/0_Bruddle/TitleBlock'
import DepositProcessingScreen from '@/components/AddMoney/components/DepositProcessingScreen'
import SupportedEvmNetworksCard from '@/components/AddMoney/components/SupportedEvmNetworksCard'
import SupportedTokensRow from '@/components/AddMoney/components/SupportedTokensRow'
import { useCryptoDepositPolling } from '@/components/AddMoney/hooks/useCryptoDepositPolling'
import CopyField from '@/components/Global/CopyField'
import Loading from '@/components/Global/Loading'
import QRCodeWrapper from '@/components/Global/QRCodeWrapper'
import { NETWORK_LABELS } from '@/constants/rhino.consts'
import { useAuth } from '@/context/authContext'
import { captureCryptoDepositCompleted } from '@/features/add-money/captureCryptoDepositCompleted'
import { useRhinoDepositAddress } from '@/features/add-money/useRhinoDepositAddress'
import { cardCryptoAskUsd } from '@/features/card/cardAddMoney'
import { RAIN_CARD_OVERVIEW_QUERY_KEY } from '@/hooks/useRainCardOverview'
import type { RhinoChainType } from '@/services/services.types'
import { formatBankAmount } from '@/utils/currency'
import { middleEllipsisAccount } from '@/utils/general.utils'

const usd = (amount: number) => formatBankAmount(amount, 'USD')
const cents = (amount: number) => Math.round(amount * 100) / 100
/** the copy field fits about this many characters at 375px; the last 4 stay visible */
const ADDRESS_DISPLAY_CHARS = 24

/**
 * The deposit address for one network, asking for the card gap (RhinoDepositView's states, sized for
 * the drawer). A deposit refreshes the balance and the card overview at once; processing lasts until
 * the balance read moves, then the step closes the drawer, names what is still missing, or says done.
 */
export function CardCryptoDepositView({
    network,
    gapUsd,
    spendableUsd,
    onDone,
}: {
    network: RhinoChainType
    gapUsd: number | undefined
    spendableUsd: number | undefined
    onDone: () => void
}) {
    const t = useTranslations('card.addMoney')
    const tCrypto = useTranslations('addMoney.crypto')
    const tPayment = useTranslations('payment')
    const tCommon = useTranslations('common')
    const queryClient = useQueryClient()
    const { user } = useAuth()
    const networkLabel = NETWORK_LABELS[network]
    const familyLabel = network === 'EVM' ? tCrypto('evmNetworks') : networkLabel

    const { data, isLoading, isError, refetch } = useRhinoDepositAddress(network, true)
    const depositAddress = data?.depositAddress
    const depositAddressRef = useRef(depositAddress)
    depositAddressRef.current = depositAddress
    // The balance every reported deposit has already landed on. A reported deposit is processing until
    // the live read rises above it, so the ask for any rest is computed from a gap that includes it.
    const landedRef = useRef<number>()
    if (landedRef.current === undefined && spendableUsd !== undefined) landedRef.current = spendableUsd

    // what this address asks for: the live gap, or the network minimum when that is higher
    const ask = data && gapUsd ? cardCryptoAskUsd(gapUsd, data.minDepositLimitUsd) : undefined
    const askRef = useRef(ask?.askUsd)
    askRef.current = ask?.askUsd
    // the ask the user sent against, frozen when the deposit is first seen: the balance poll can show
    // the money before the status says completed, and the live ask then already counts it
    const askedRef = useRef<number>()

    /**
     * A deposit Rhino reported, until it resolves. `from`: the landed balance it must rise above;
     * undefined for a deposit already on its way when the drawer opened, whose money may already be in
     * the balance, so one fresh read decides it. `refreshed`: that read came back.
     */
    const [pending, setPending] = useState<{
        amount: number
        asked: number | undefined
        from: number | undefined
        refreshed: boolean
    }>()
    // the notice after a deposit that left a gap: what came in against what was asked
    const [shortDeposit, setShortDeposit] = useState<{ received: number; asked: number }>()
    const [done, setDone] = useState(false)

    // The API keeps an address's last outcome for hours. The first read, at once when the address
    // arrives, decides: a deposit still on its way stays and shows processing, so no second send is
    // invited; a completed or failed outcome is an earlier deposit's and is cleared.
    const [checkedFor, setCheckedFor] = useState<string>()
    const checkedForRef = useRef<string>()
    const inFlightAtOpen = useRef(false)
    const [clearingStale, setClearingStale] = useState(false)
    const [clearFailed, setClearFailed] = useState(false)

    const handleSuccess = useCallback(
        (amount: number) => {
            // the first read's outcome belongs to an earlier deposit, which the check below clears
            if (!depositAddressRef.current || checkedForRef.current !== depositAddressRef.current) return
            captureCryptoDepositCompleted(amount, network, user?.invitedBy)
            const from = inFlightAtOpen.current ? undefined : landedRef.current
            inFlightAtOpen.current = false
            setPending({ amount, asked: askedRef.current ?? askRef.current, from, refreshed: false })
            askedRef.current = undefined
            void Promise.all([
                queryClient.invalidateQueries({ queryKey: ['balance'] }),
                queryClient.invalidateQueries({ queryKey: [RAIN_CARD_OVERVIEW_QUERY_KEY] }),
            ]).finally(() => setPending((p) => (p ? { ...p, refreshed: true } : p)))
        },
        [queryClient, network, user?.invitedBy]
    )
    const { status, resetStatus, isResetting, isStatusRead } = useCryptoDepositPolling(
        depositAddress,
        handleSuccess,
        undefined,
        { readNow: true }
    )

    useEffect(() => {
        if (status === 'loading' && askedRef.current === undefined && checkedForRef.current)
            askedRef.current = askRef.current
    }, [status])

    // A completed outcome may be a deposit made seconds ago on /add-money/crypto: the address shows only
    // after a fresh balance read, so the ask never invites a second send for money already in.
    const clearStale = useCallback(
        (refreshBalance: boolean) => {
            setClearingStale(true)
            setClearFailed(false)
            Promise.all([
                // a status left uncleared stops the poll, and no new deposit would ever show
                resetStatus().catch(() => setClearFailed(true)),
                refreshBalance &&
                    Promise.allSettled([
                        queryClient.invalidateQueries({ queryKey: ['balance'] }),
                        queryClient.invalidateQueries({ queryKey: [RAIN_CARD_OVERVIEW_QUERY_KEY] }),
                    ]),
            ]).finally(() => {
                landedRef.current = undefined
                setClearingStale(false)
            })
        },
        [resetStatus, queryClient]
    )
    useEffect(() => {
        if (!depositAddress || !isStatusRead || checkedForRef.current === depositAddress) return
        checkedForRef.current = depositAddress
        setCheckedFor(depositAddress)
        if (status === 'loading') inFlightAtOpen.current = true
        if (status === 'completed' || status === 'failed') clearStale(status === 'completed')
    }, [depositAddress, isStatusRead, status, clearStale])

    // a reported deposit lands: the live gap says done (the step closes a drawer opened short), or
    // names the rest; the poll is re-armed for it below
    useEffect(() => {
        if (!pending || spendableUsd === undefined || gapUsd === undefined) return
        const landed = pending.from === undefined ? pending.refreshed : spendableUsd > pending.from + 0.005
        if (!landed) return
        landedRef.current = spendableUsd
        setPending(undefined)
        if (gapUsd <= 0) {
            setDone(true)
            return
        }
        // what reached the balance, when its start is known: a fee taken on the way shows here
        const received = pending.from === undefined ? pending.amount : cents(spendableUsd - pending.from)
        // never less than what came in plus what is still needed
        setShortDeposit({ received, asked: Math.max(pending.asked ?? 0, cents(received + gapUsd)) })
    }, [pending, spendableUsd, gapUsd])

    // Rhino reports one deposit per address until the status is cleared: after a short deposit the
    // clear re-arms the poll for the rest, as RhinoDepositView does
    useEffect(() => {
        if (!shortDeposit) return
        resetStatus().catch(() => {
            // the next transfer still books on the backend; the balance poll shows it
        })
    }, [shortDeposit, resetStatus])

    if (isLoading || (data && (checkedFor !== data.depositAddress || clearingStale))) {
        return (
            <div className="flex justify-center py-10">
                <Loading variant="mascot" />
            </div>
        )
    }

    // the old outcome could not be cleared, so the poll would miss the next deposit: retry before the address
    if (clearFailed) {
        return (
            <div className="flex flex-col gap-4" data-testid="card-add-money-clear-failed">
                <Callout priority="error" title={tCrypto('addressErrorTitle')}>
                    {tCrypto('addressErrorDescription')}
                </Callout>
                <Button variant="primary" className="w-full" onClick={() => clearStale(false)}>
                    {tCommon('retry')}
                </Button>
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

    if (status === 'failed') {
        return (
            <div className="flex flex-col gap-4">
                {/* the drawer keeps what the user needs: the money comes back, and they can try again */}
                <Callout priority="attention" title={tCrypto('marketMovedTitle')}>
                    {tCrypto('marketMovedNote')}
                </Callout>
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

    // detected and settling, or reported while the balance read catches up: no second deposit invited
    if (status === 'loading' || pending) {
        return (
            <div className="py-6" data-testid="card-add-money-processing">
                <DepositProcessingScreen />
            </div>
        )
    }

    if (done) {
        return (
            <div className="flex flex-col items-center gap-4 text-center" data-testid="card-add-money-done">
                <IconBubble icon="check" color="green" />
                <TitleBlock align="center" size="s" title={t('doneTitle')} />
                <Button variant="primary" className="w-full" onClick={onDone}>
                    {tCommon('done')}
                </Button>
            </div>
        )
    }

    return (
        <div className="flex flex-col items-center gap-4" data-testid="card-add-money-address">
            {shortDeposit && (
                <Callout
                    priority="attention"
                    className="w-full"
                    data-testid="card-add-money-short"
                    title={tPayment('partialContribution.title', {
                        received: usd(shortDeposit.received),
                        asked: usd(shortDeposit.asked),
                    })}
                />
            )}
            {/* the amount first: at 375px the QR and the warning push anything below out of sight */}
            {ask && (
                <div className="flex w-full flex-col gap-1" data-testid="card-add-money-ask">
                    <p className="text-body-m-semibold text-foreground-primary">
                        {t('sendAsk', { amount: usd(ask.askUsd) })}
                    </p>
                    {ask.raisedToMinimum && gapUsd && (
                        <p className="text-body-s text-foreground-secondary">
                            {t('raisedToMinimum', {
                                network: familyLabel,
                                minimum: usd(ask.askUsd),
                                extra: usd(cents(ask.askUsd - gapUsd)),
                            })}
                        </p>
                    )}
                    <p className="text-body-s text-foreground-secondary">{tCrypto('sendExtraForFees')}</p>
                </div>
            )}
            <p className="text-body-m text-foreground-primary">{t('depositAddress', { network: networkLabel })}</p>
            <QRCodeWrapper url={data.depositAddress} />
            <CopyField
                text={data.depositAddress}
                displayText={middleEllipsisAccount(data.depositAddress, ADDRESS_DISPLAY_CHARS)}
            />
            <Callout priority="attention" title={t('networkOnlyTitle', { network: networkLabel })}>
                <div className="flex flex-col gap-2">
                    <p>{tCrypto('warningDescription')}</p>
                    <SupportedTokensRow network={network} className="flex-wrap" />
                </div>
            </Callout>
            {network === 'EVM' && <SupportedEvmNetworksCard />}
            <div className="flex items-center gap-2 text-body-s text-foreground-secondary">
                <Loading />
                <span>{t('waiting')}</span>
            </div>
        </div>
    )
}
