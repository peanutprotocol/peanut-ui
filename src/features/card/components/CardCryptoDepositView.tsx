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
import { cardDepositView } from '@/features/card/cardDepositView'
import { RAIN_CARD_OVERVIEW_QUERY_KEY } from '@/hooks/useRainCardOverview'
import type { DepositAddressStatusResponse, RhinoChainType } from '@/services/services.types'
import { formatBankAmount } from '@/utils/currency'
import { middleEllipsisAccount } from '@/utils/general.utils'

const usd = (amount: number) => formatBankAmount(amount, 'USD')
const cents = (amount: number) => Math.round(amount * 100) / 100
/** the copy field fits about this many characters at 375px; the last 4 stay visible */
const ADDRESS_DISPLAY_CHARS = 24
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
     * the balance every earlier deposit landed on. A deposit in flight at open is measured from the
     * balance at open and waits for the rise with no cap: the drawer can be closed, and the address never
     * shows for money on its way. `refreshed`: a fresh balance read came back (it decides only when no
     * balance was known at the report).
     */
    const [pending, setPending] = useState<{ amount: number; from: number | undefined; refreshed: boolean }>()
    // the notice after a deposit that left a gap: what came in; the live gap is what is still needed
    // `n` counts short deposits, so a second one of the same amount still re-arms the poll
    const [shortDeposit, setShortDeposit] = useState<{ received: number; n: number }>()
    const [done, setDone] = useState(false)

    // The API keeps an address's last outcome for hours. The first answer for the address decides: a
    // deposit on its way stays and shows processing; a completed or failed outcome is an earlier
    // deposit's, cleared (a completed one against a fresh balance read) before any address shows.
    const [checkedFor, setCheckedFor] = useState<string>()
    const checkedForRef = useRef<string>()
    const [clearing, setClearing] = useState(false)
    const [clearFailed, setClearFailed] = useState(false)
    // whether the last clear needed a fresh balance read, so its retry needs one too
    const clearRefreshesBalance = useRef(false)

    /** a fresh balance and card overview; rejects when either read fails */
    const refreshBalance = useCallback(
        () =>
            Promise.all([
                queryClient.invalidateQueries({ queryKey: ['balance'] }, { throwOnError: true }),
                queryClient.invalidateQueries({ queryKey: [RAIN_CARD_OVERVIEW_QUERY_KEY] }, { throwOnError: true }),
            ]),
        [queryClient]
    )

    const handleSuccess = useCallback(
        (amount: number, statusData?: DepositAddressStatusResponse) => {
            const address = depositAddressRef.current
            if (!address) return
            // sent once per deposit, so an outcome another surface (or an earlier opening) reported is not
            // counted twice, and one nobody saw complete is counted when the drawer reads it at open
            captureCryptoDepositCompleted(amount, network, user?.invitedBy, { address, txHash: statusData?.txHash })
            // an outcome read at open is an earlier deposit's: the check below clears it
            if (checkedForRef.current !== address) return
            setPending({ amount, from: landedRef.current, refreshed: false })
            refreshBalance()
                .then(() => setPending((p) => (p ? { ...p, refreshed: true } : p)))
                .catch(() => {
                    // the balance poll still shows the deposit; processing waits for it
                })
        },
        [network, user?.invitedBy, refreshBalance]
    )
    const { status, resetStatus, isResetting, isStatusRead, statusError, refetchStatus } = useCryptoDepositPolling(
        depositAddress,
        handleSuccess,
        undefined,
        { readNow: true }
    )

    const clearStale = useCallback(
        (withBalance: boolean) => {
            clearRefreshesBalance.current = withBalance
            setClearing(true)
            setClearFailed(false)
            // a status left uncleared stops the poll, so no new deposit would show; a completed deposit
            // may be in the balance only after a fresh read, so the ask waits for one
            Promise.all([resetStatus(), withBalance ? refreshBalance() : undefined])
                .then(() => {
                    landedRef.current = undefined
                })
                .catch(() => setClearFailed(true))
                .finally(() => setClearing(false))
        },
        [resetStatus, refreshBalance]
    )
    useEffect(() => {
        if (!depositAddress || !isStatusRead || checkedForRef.current === depositAddress) return
        checkedForRef.current = depositAddress
        setCheckedFor(depositAddress)
        if (status === 'completed' || status === 'failed') clearStale(status === 'completed')
    }, [depositAddress, isStatusRead, status, clearStale])

    // a reported deposit lands: the live gap says done (the step closes a drawer opened short), or
    // names the rest; the poll is re-armed for it below
    useEffect(() => {
        if (!pending || spendableUsd === undefined || gapUsd === undefined) return
        const rose = roseAbove(pending.from, spendableUsd)
        // no balance known at the report: the fresh read after it decides
        if (!rose && !(pending.from === undefined && pending.refreshed)) return
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

    // Rhino reports one deposit per address until the status is cleared: after a short deposit the
    // clear re-arms the poll for the rest, as RhinoDepositView does; a failed clear offers a retry
    useEffect(() => {
        if (!shortDeposit) return
        clearRefreshesBalance.current = false
        resetStatus().catch(() => setClearFailed(true))
    }, [shortDeposit, resetStatus])

    const view = cardDepositView({
        addressLoading: isLoading,
        addressError: isError || (!isLoading && !data),
        statusRead: isStatusRead,
        statusError,
        status,
        checked: !!data && checkedFor === data.depositAddress,
        clearing,
        clearFailed,
        pending: !!pending,
        done,
    })
    const processing = view === 'processing'
    useEffect(() => onProcessingChange(processing), [processing, onProcessingChange])

    if (view === 'loading') {
        return (
            <div className="flex justify-center py-10">
                <Loading variant="mascot" />
            </div>
        )
    }

    // the drawer cannot tell whether a deposit is on its way: no address until it can
    if (view === 'check-failed') {
        return (
            <div className="flex flex-col gap-4" data-testid="card-add-money-check-failed">
                <Callout priority="error" title={t('statusCheckFailedTitle')}>
                    {t('statusCheckFailedBody')}
                </Callout>
                <Button
                    variant="primary"
                    className="w-full"
                    onClick={() => (clearFailed ? clearStale(clearRefreshesBalance.current) : void refetchStatus())}
                >
                    {tCommon('retry')}
                </Button>
            </div>
        )
    }

    if (view === 'address-error' || !data) {
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

    if (view === 'failed') {
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

    // on its way, or reported while the balance read catches up: no second deposit invited
    if (processing) {
        return (
            <div className="py-6" data-testid="card-add-money-processing">
                <DepositProcessingScreen />
            </div>
        )
    }

    if (view === 'done') {
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
                    <SupportedTokensRow network={network} stacked />
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
