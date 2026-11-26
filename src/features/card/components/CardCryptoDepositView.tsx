'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Address } from 'viem'
import { Button } from '@/components/0_Bruddle/Button'
import { Callout } from '@/components/0_Bruddle/Callout'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
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
import { cardCryptoAskUsd, cardGapUsd } from '@/features/card/cardAddMoney'
import { cardDepositView, type DepositStatus } from '@/features/card/cardDepositView'
import { readLiveSpendableUsd } from '@/features/card/readLiveSpendableUsd'
import { useWallet } from '@/hooks/wallet/useWallet'
import type { DepositAddressStatusResponse, RhinoChainType } from '@/services/services.types'
import { formatBankAmount } from '@/utils/currency'
import { middleEllipsisAccount } from '@/utils/general.utils'
import { CardDrawerStatus } from './CardDrawerStatus'

const usd = (amount: number) => formatBankAmount(amount, 'USD')
const cents = (amount: number) => Math.round(amount * 100) / 100
/** the copy field fits about this many characters at 375px; the last 4 stay visible */
const ADDRESS_DISPLAY_CHARS = 24
/** a held deposit is read fresh at once, every 5 s for half a minute, then every 15 s */
const holdReadDelay = (reads: number) => (reads === 0 ? 0 : reads < 6 ? 5_000 : 15_000)
/**
 * Successful fresh reads with no rise (about a minute: the 5 s phase, then 15 s reads) that show a
 * completed outcome found at open was already in the balance. A failed read never counts.
 */
const ALREADY_IN_READS = 8
/** the balance rose above where a deposit started, by more than a rounding cent */
const roseAbove = (from: number, spendable: number) => spendable > from + 0.005

type Hold = {
    /** the fresh read the deposit must rise above */
    from: number
    /** a completed outcome found at open (or the same one written back after a clear): it may already be in */
    alreadyIn: boolean
    /** reads so far, failed ones too: they pace the next read */
    reads: number
    /** successful reads that did not rise: only these count toward `waited` */
    flat: number
    /**
     * an `alreadyIn` hold read flat for about a minute: the deposit is probably in, but the drawer never
     * guesses. It says the deposit may still be landing and shows the address only on an explicit tap.
     */
    waited: boolean
}

/**
 * The deposit address for one network, asking for the card gap (RhinoDepositView's states, sized for
 * the drawer). The address and the ask come only through `cardDepositView`'s rule: the API's own "not
 * started" and a fresh balance read. Every money decision here reads the balance fresh
 * (`readLiveSpendableUsd`), never the step's cached value.
 */
export function CardCryptoDepositView({
    network,
    onDone,
    onProcessingChange,
}: {
    network: RhinoChainType
    onDone: () => void
    /** a deposit is settling: the drawer hides its back, so a second address is never one tap away */
    onProcessingChange: (processing: boolean) => void
}) {
    const t = useTranslations('card.addMoney')
    const tCrypto = useTranslations('addMoney.crypto')
    const tAdd = useTranslations('addMoney')
    const tCommon = useTranslations('common')
    const queryClient = useQueryClient()
    const { user } = useAuth()
    const { address: wallet } = useWallet()
    const userId = user?.user?.userId
    const networkLabel = NETWORK_LABELS[network]
    const familyLabel = network === 'EVM' ? tCrypto('evmNetworks') : networkLabel

    const { data, isLoading, isError, refetch } = useRhinoDepositAddress(network, true)
    const depositAddress = data?.depositAddress
    const depositAddressRef = useRef(depositAddress)
    depositAddressRef.current = depositAddress

    // The last fresh spendable read, and whether one came back since the last clear.
    const [live, setLive] = useState<number>()
    const [balanceFresh, setBalanceFresh] = useState(false)
    const [balanceReadFailed, setBalanceReadFailed] = useState(false)
    const readLive = useCallback(async () => {
        const value = await readLiveSpendableUsd(queryClient, { address: wallet as Address | undefined, userId })
        setLive(value)
        return value
    }, [queryClient, wallet, userId])
    // The balance every resolved deposit landed on: the fresh read at open, then each landing's read.
    const landedRef = useRef<number>()

    // A deposit seen on its way or reported, until a fresh read shows the balance above `from`.
    const [hold, setHold] = useState<Hold>()
    // the balance rose before the provider said completed: that completion is this deposit's, not a new
    // one, unless it reports more than came in (then another inflow landed meanwhile and it is held)
    const landedBeforeCompleted = useRef<number | null>(null)
    // the completed outcome found at open (transaction, or amount): the same one written back after a
    // clear is that old deposit again, not a new one
    const openOutcome = useRef<string | null>(null)
    // the notice after a deposit that left a gap: what came in; `n` counts them, so a second short
    // deposit of the same amount still re-arms the poll
    const [shortDeposit, setShortDeposit] = useState<{ received: number; n: number }>()
    const [done, setDone] = useState(false)

    const [checkedFor, setCheckedFor] = useState<string>()
    const checkedForRef = useRef<string>()
    const [clearing, setClearing] = useState(false)
    const [clearFailed, setClearFailed] = useState(false)
    const clearRef = useRef<() => Promise<void>>(async () => {})

    const handleSuccess = useCallback(
        (amount: number, statusData?: DepositAddressStatusResponse) => {
            const address = depositAddressRef.current
            if (!address) return
            const outcome = statusData?.txHash?.toLowerCase() ?? `amount:${amount}`
            const atOpen = checkedForRef.current !== address
            const repeatOfOpen = !atOpen && outcome === openOutcome.current
            // sent once per deposit, so an outcome another surface (or an earlier opening) reported is not
            // counted twice, and one nobody saw complete is counted when the drawer reads it at open
            if (!repeatOfOpen)
                captureCryptoDepositCompleted(amount, network, user?.invitedBy, { address, txHash: statusData?.txHash })
            // an outcome read at open is held by the open check below
            if (atOpen) {
                openOutcome.current = outcome
                return
            }
            const rose = landedBeforeCompleted.current
            if (rose !== null) {
                landedBeforeCompleted.current = null
                // what rose is this deposit: clear for the next one; more reported than rose: hold the rest
                if (amount <= rose + 0.01) {
                    void clearRef.current()
                    return
                }
            }
            setHold(
                (current) =>
                    current ?? { from: landedRef.current!, alreadyIn: repeatOfOpen, reads: 0, flat: 0, waited: false }
            )
        },
        [network, user?.invitedBy]
    )
    const { status, resetStatus, isStatusRead, statusError, statusFailing, refetchStatus } = useCryptoDepositPolling(
        depositAddress,
        handleSuccess,
        undefined,
        { readNow: true }
    )

    /** clears the address's outcome, then reads the balance fresh; the address waits for both */
    const clear = useCallback(async () => {
        setClearing(true)
        setClearFailed(false)
        setBalanceReadFailed(false)
        setBalanceFresh(false)
        try {
            await resetStatus()
        } catch {
            // a status left uncleared stops the poll, so no new deposit would show
            setClearFailed(true)
            setClearing(false)
            return
        }
        try {
            await readLive()
            setBalanceFresh(true)
        } catch {
            setBalanceReadFailed(true)
        }
        setClearing(false)
    }, [resetStatus, readLive])
    clearRef.current = clear

    /** the API's first answer for this address, taken in against a fresh balance read */
    const statusRef = useRef(status)
    statusRef.current = status
    const open = useCallback(
        async (address: string, first: DepositStatus) => {
            setBalanceReadFailed(false)
            let baseline: number
            try {
                baseline = await readLive()
            } catch {
                setBalanceReadFailed(true)
                return
            }
            if (depositAddressRef.current !== address) return
            landedRef.current = baseline
            checkedForRef.current = address
            setCheckedFor(address)
            // the status may have moved while the balance was read: act on the one now
            const now = statusRef.current === 'not_started' ? first : statusRef.current
            if (now === 'loading' || now === 'completed')
                // only an outcome already completed at the first answer may be in the balance read at open
                setHold({
                    from: baseline,
                    alreadyIn: now === 'completed' && first !== 'loading',
                    reads: 0,
                    flat: 0,
                    waited: false,
                })
            if (now === 'completed' || now === 'failed') void clear()
            else setBalanceFresh(true)
        },
        [readLive, clear]
    )
    const openedFor = useRef<string>()
    useEffect(() => {
        if (!depositAddress || !isStatusRead || openedFor.current === depositAddress) return
        openedFor.current = depositAddress
        void open(depositAddress, status)
    }, [depositAddress, isStatusRead, status, open])

    // a deposit that goes on its way after open is held from where the balance last landed
    useEffect(() => {
        if (status !== 'loading' || !depositAddress || checkedFor !== depositAddress) return
        if (landedBeforeCompleted.current !== null) return
        setClearFailed(false)
        setHold(
            (current) => current ?? { from: landedRef.current!, alreadyIn: false, reads: 0, flat: 0, waited: false }
        )
    }, [status, depositAddress, checkedFor])

    // Each held deposit is read fresh until the balance rises above where it started (or the gap is
    // covered); a completed outcome found at open counts as already in after reads that never rise.
    // A deposit on its way has no cap: the drawer can be closed, and its address never shows meanwhile.
    useEffect(() => {
        if (!hold) return
        const timer = setTimeout(async () => {
            let value: number
            try {
                value = await readLive()
            } catch {
                // the next read tries again
                setHold((current) => current && { ...current, reads: current.reads + 1 })
                return
            }
            const gap = cardGapUsd(value) ?? 0
            if (roseAbove(hold.from, value) || gap <= 0) {
                landedRef.current = value
                setHold(undefined)
                if (gap <= 0) {
                    setDone(true)
                    return
                }
                // what reached the balance: a fee taken on the way shows here
                setShortDeposit((last) => ({ received: cents(value - hold.from), n: (last?.n ?? 0) + 1 }))
                return
            }
            // flat for about a minute: keep reading, and let the user choose to send more
            setHold(
                (current) =>
                    current && {
                        ...current,
                        reads: current.reads + 1,
                        flat: current.flat + 1,
                        waited: current.waited || (current.alreadyIn && current.flat + 1 >= ALREADY_IN_READS),
                    }
            )
        }, holdReadDelay(hold.reads))
        return () => clearTimeout(timer)
    }, [hold, readLive])

    // Rhino reports one deposit per address until the status is cleared: after a short deposit the
    // clear re-arms the poll for the rest, and the address waits for its fresh read. A deposit that
    // rose before the provider said completed is cleared when that completion arrives.
    useEffect(() => {
        if (!shortDeposit) return
        if (statusRef.current === 'completed') void clearRef.current()
        else if (statusRef.current === 'loading') landedBeforeCompleted.current = shortDeposit.received
    }, [shortDeposit])

    const view = cardDepositView({
        addressLoading: isLoading,
        addressError: isError || (!isLoading && !data),
        statusRead: isStatusRead,
        statusError,
        statusFailing,
        status,
        checked: !!data && checkedFor === data.depositAddress,
        balanceFresh,
        balanceReadFailed,
        clearing,
        clearFailed,
        holding: !!hold,
        done,
    })
    const processing = view === 'processing'
    useEffect(() => onProcessingChange(processing), [processing, onProcessingChange])

    /** "Send more instead": the user chose to see the address while a deposit may still be landing */
    const sendMore = () => {
        if (live !== undefined) landedRef.current = live
        setHold(undefined)
        // a completed status left in place stops the poll: clear it; either way the ask waits for a fresh read
        if (statusRef.current === 'completed') return void clear()
        setBalanceFresh(false)
        readLive().then(
            () => setBalanceFresh(true),
            () => setBalanceReadFailed(true)
        )
    }

    const retry = () => {
        if (clearFailed) return void clear()
        if (balanceReadFailed && depositAddress && checkedFor !== depositAddress) {
            openedFor.current = depositAddress
            return void open(depositAddress, status)
        }
        if (balanceReadFailed) {
            setBalanceReadFailed(false)
            return void readLive().then(
                () => setBalanceFresh(true),
                () => setBalanceReadFailed(true)
            )
        }
        void refetchStatus()
    }

    if (view === 'loading') {
        return (
            <div className="flex justify-center py-10">
                <Loading variant="mascot" />
            </div>
        )
    }

    // the drawer cannot tell whether a deposit is on its way, or what the balance is: no address until it can
    if (view === 'check-failed') {
        return (
            <div className="flex flex-col gap-4" data-testid="card-add-money-check-failed">
                <Callout priority="error" title={t('statusCheckFailedTitle')}>
                    {t('statusCheckFailedBody')}
                </Callout>
                <Button variant="primary" className="w-full" onClick={retry}>
                    {tCommon('retry')}
                </Button>
            </div>
        )
    }

    if (view === 'address-error' || !data) {
        return (
            <CardDrawerStatus
                icon={<IconBubble icon="alert" color="red" />}
                name={tCrypto('addressErrorTitle')}
                body={tCrypto('addressErrorDescription')}
            >
                <Button variant="primary" className="w-full" onClick={() => void refetch()}>
                    {tCommon('retry')}
                </Button>
            </CardDrawerStatus>
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
                    onClick={() => {
                        setHold(undefined)
                        void clear()
                    }}
                    loading={clearing}
                    disabled={clearing}
                >
                    {tCommon('tryAgain')}
                </Button>
            </div>
        )
    }

    // on its way, or reported while a fresh read catches up: no second deposit invited
    if (processing) {
        return (
            <div className="py-6">
                <CardDrawerStatus
                    icon={<Loading variant="mascot" />}
                    name={tAdd('processingDepositTitle')}
                    body={hold?.waited ? t('stillLandingBody') : tAdd('processingDepositBody')}
                    testId="card-add-money-processing"
                >
                    {hold?.waited && (
                        <div className="mt-2 flex justify-center">
                            <LinkButton onClick={sendMore} data-testid="card-add-money-send-more">
                                {t('sendMoreInstead')}
                            </LinkButton>
                        </div>
                    )}
                </CardDrawerStatus>
            </div>
        )
    }

    if (view === 'done') {
        return (
            <CardDrawerStatus
                icon={<IconBubble icon="check" color="green" />}
                name={t('doneTitle')}
                testId="card-add-money-done"
            >
                <Button variant="primary" className="w-full" onClick={onDone}>
                    {tCommon('done')}
                </Button>
            </CardDrawerStatus>
        )
    }

    // the ask comes from the fresh read: the live gap, or the network minimum when that is higher
    const gapUsd = live === undefined ? undefined : cardGapUsd(live)
    const ask = gapUsd ? cardCryptoAskUsd(gapUsd, data.minDepositLimitUsd) : undefined
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
            {ask && gapUsd && (
                <div className="flex w-full flex-col gap-1" data-testid="card-add-money-ask">
                    <p className="text-body-m-semibold text-foreground-primary">
                        {t('sendAsk', { amount: usd(ask.askUsd) })}
                    </p>
                    {ask.raisedToMinimum && (
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
