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
    const spendableRef = useRef(spendableUsd)
    spendableRef.current = spendableUsd

    // the balance this round of asking started from: a credited deposit is in once the read moves off it
    const [round, setRound] = useState<{ spendable: number }>()
    useEffect(() => {
        if (!round && spendableUsd !== undefined) setRound({ spendable: spendableUsd })
    }, [round, spendableUsd])

    const [shortDeposit, setShortDeposit] = useState<{ received: number; asked: number }>()
    // after a short deposit, what is missing: the smaller of the refreshed gap and the unpaid part of
    // the ask, so it is right before the balance read lands and after it
    const shortRest = shortDeposit ? Math.max(cents(shortDeposit.asked - shortDeposit.received), 0.01) : undefined
    const needUsd = shortRest !== undefined ? Math.min(gapUsd ?? shortRest, shortRest) : gapUsd
    const ask = data && needUsd ? cardCryptoAskUsd(needUsd, data.minDepositLimitUsd) : undefined
    const askRef = useRef(ask?.askUsd)
    askRef.current = ask?.askUsd

    // a full deposit reported, with what it was asked for: processing until the balance read moves
    const [credited, setCredited] = useState<{ asked: number | undefined }>()
    const [done, setDone] = useState(false)

    // The API keeps an address's last outcome for hours. The first read, at once when the address
    // arrives, decides: a deposit still on its way stays and shows processing, so no second send is
    // invited; a completed or failed outcome is an earlier deposit's and is cleared.
    const [checkedFor, setCheckedFor] = useState<string>()
    const checkedForRef = useRef<string>()
    const [clearingStale, setClearingStale] = useState(false)

    const handleSuccess = useCallback(
        (amount: number) => {
            // the first read's outcome belongs to an earlier deposit, which the check below clears
            if (!depositAddressRef.current || checkedForRef.current !== depositAddressRef.current) return
            void queryClient.invalidateQueries({ queryKey: ['balance'] })
            void queryClient.invalidateQueries({ queryKey: [RAIN_CARD_OVERVIEW_QUERY_KEY] })
            captureCryptoDepositCompleted(amount, network, user?.invitedBy)
            const asked = askRef.current
            if (asked !== undefined && amount < asked - 0.005) {
                setShortDeposit({ received: amount, asked })
                // the next round starts here, so the next deposit is in once the read moves off this
                const spendable = spendableRef.current
                if (spendable !== undefined) setRound({ spendable })
            } else setCredited({ asked })
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
        if (!depositAddress || !isStatusRead || checkedForRef.current === depositAddress) return
        checkedForRef.current = depositAddress
        setCheckedFor(depositAddress)
        if (status !== 'completed' && status !== 'failed') return
        setClearingStale(true)
        resetStatus()
            .catch(() => {
                // the clear failed: the balance read still moves the step once the money is in
            })
            .finally(() => setClearingStale(false))
    }, [depositAddress, isStatusRead, status, resetStatus])

    // the balance read moved after a credited deposit: the gap is closed, or a fee left part of it
    useEffect(() => {
        if (!credited || !round || spendableUsd === undefined || gapUsd === undefined) return
        if (spendableUsd === round.spendable) return
        setCredited(undefined)
        setRound({ spendable: spendableUsd })
        if (gapUsd <= 0) setDone(true)
        else if (credited.asked !== undefined)
            setShortDeposit({ received: cents(spendableUsd - round.spendable), asked: credited.asked })
    }, [credited, round, spendableUsd, gapUsd])

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

    // detected and settling, or credited while the balance read catches up: no second deposit invited
    if (status === 'loading' || credited) {
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
                    {ask.raisedToMinimum && needUsd && (
                        <p className="text-body-s text-foreground-secondary">
                            {t('raisedToMinimum', {
                                network: familyLabel,
                                minimum: usd(ask.askUsd),
                                extra: usd(cents(ask.askUsd - needUsd)),
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
