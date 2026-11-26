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
/** a deposit in flight at open whose balance did not rise: re-reads before it counts as already in */
const IN_FLIGHT_REREADS = 6
const IN_FLIGHT_REREAD_MS = 5000
/** the balance rose above where a deposit started, by more than a rounding cent */
const roseAbove = (from: number | undefined, spendable: number | undefined) =>
    from !== undefined && spendable !== undefined && spendable > from + 0.005

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
    onProcessingChange,
}: {
    network: RhinoChainType
    gapUsd: number | undefined
    spendableUsd: number | undefined
    onDone: () => void
    /** a deposit is settling: the drawer hides its back, so a second address is never one tap away */
    onProcessingChange: (processing: boolean) => void
}) {
    const t = useTranslations('card.addMoney')
    const tCrypto = useTranslations('addMoney.crypto')
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

    /**
     * A deposit Rhino reported, until it resolves: it has landed once the balance rises above `from`,
     * the balance every earlier deposit landed on. A deposit already on its way when the drawer opened
     * (`inFlight`) may have reached the balance before the drawer read it, so a balance that does not
     * rise is read again a few times before the deposit counts as already in (`assumedIn`).
     */
    const [pending, setPending] = useState<{
        amount: number
        from: number | undefined
        inFlight: boolean
        refreshed: boolean
        rereads: number
        assumedIn: boolean
    }>()
    // the notice after a deposit that left a gap: what came in; the live gap is what is still needed
    // `n` counts short deposits, so a second one of the same amount still re-arms the poll
    const [shortDeposit, setShortDeposit] = useState<{ received: number; n: number }>()
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
            setPending({
                amount,
                from: landedRef.current,
                inFlight: inFlightAtOpen.current,
                refreshed: false,
                rereads: 0,
                assumedIn: false,
            })
            inFlightAtOpen.current = false
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
        // no balance known at open: the fresh read after the report decides
        const rose = roseAbove(pending.from, spendableUsd)
        const landed = rose || pending.assumedIn || (pending.from === undefined && pending.refreshed)
        if (!landed) return
        landedRef.current = spendableUsd
        setPending(undefined)
        if (gapUsd <= 0) {
            setDone(true)
            return
        }
        // what reached the balance when it rose: a fee taken on the way shows here
        const received = rose ? cents(spendableUsd - pending.from!) : pending.amount
        setShortDeposit((last) => ({ received, n: (last?.n ?? 0) + 1 }))
    }, [pending, spendableUsd, gapUsd])

    // A deposit in flight at open whose fresh read did not rise: the read may be stale, or the money was
    // already in at open. Each re-read is a real refetch; after ~30 s of reads that never rise it counts as
    // already in, so the drawer cannot hang in processing. A deposit reported after open has no cap: its
    // start is known, so it waits for the rise.
    useEffect(() => {
        if (!pending?.inFlight || !pending.refreshed || pending.assumedIn || roseAbove(pending.from, spendableUsd))
            return
        const timer = setTimeout(() => {
            if (pending.rereads >= IN_FLIGHT_REREADS) {
                setPending((p) => p && { ...p, assumedIn: true })
                return
            }
            void queryClient
                .invalidateQueries({ queryKey: ['balance'] })
                .finally(() => setPending((p) => p && { ...p, rereads: p.rereads + 1 }))
        }, IN_FLIGHT_REREAD_MS)
        return () => clearTimeout(timer)
    }, [pending, spendableUsd, queryClient])

    // Rhino reports one deposit per address until the status is cleared: after a short deposit the
    // clear re-arms the poll for the rest, as RhinoDepositView does
    useEffect(() => {
        if (!shortDeposit) return
        resetStatus().catch(() => {
            // the next transfer still books on the backend; the balance poll shows it
        })
    }, [shortDeposit, resetStatus])

    const processing = status === 'loading' || !!pending
    useEffect(() => onProcessingChange(processing), [processing, onProcessingChange])

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
    if (processing) {
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
            {/* what is missing, never what to send: the ask below names that, raised to the minimum */}
            {shortDeposit && gapUsd ? (
                <Callout
                    priority="attention"
                    className="w-full"
                    data-testid="card-add-money-short"
                    title={t('shortReceived', { received: usd(shortDeposit.received) })}
                >
                    {t('shortStillNeeded', { remaining: usd(gapUsd) })}
                </Callout>
            ) : null}
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
                readOnlyValue
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
