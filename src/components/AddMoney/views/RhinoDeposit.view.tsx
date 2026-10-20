'use client'
import { Button } from '@/components/0_Bruddle/Button'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import Card from '@/components/Global/Card'
import CopyField from '@/components/Global/CopyField'
import NavHeader from '@/components/Global/NavHeader'
import QRCodeWrapper from '@/components/Global/QRCodeWrapper'
import ChainChip from '../components/ChainChip'
import { Callout } from '@/components/0_Bruddle/Callout'
import { Tabs } from '@/components/0_Bruddle/Tabs'
import Loading from '@/components/Global/Loading'
import ProcessingScreen from '@/components/Global/ProcessingScreen'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { useCryptoDepositPolling } from '../hooks/useCryptoDepositPolling'
import type { CreateDepositAddressResponse, RhinoChainType } from '@/services/services.types'
import { CHAIN_LOGOS, SUPPORTED_EVM_CHAINS, NETWORK_LABELS, getSupportedTokens } from '@/constants/rhino.consts'
import UserCard from '@/components/User/UserCard'
import { isCryptoAddress, printableAddress } from '@/utils/general.utils'
import { isBelowRhinoMinDeposit } from '@/utils/withdraw.utils'
import { useTranslations } from 'next-intl'
import { useEffect } from 'react'
import { formatBankAmount } from '@/utils/currency'

interface RhinoDepositViewProps {
    onBack?: () => void
    chainType: RhinoChainType
    setChainType: (chainType: RhinoChainType) => void
    depositAddressData: CreateDepositAddressResponse | undefined
    isDepositAddressDataLoading: boolean
    headerTitle: string
    onSuccess: (amount: number) => void
    showUserCard?: boolean
    amount?: number
    /** the exact amount in the token the charge settles in, e.g. "58.51 USDC"; shown on the user card */
    tokenAmount?: string
    identifier?: string
    /** the deposit bridged and the flow is waiting for the API to book it: stay on the processing state */
    isConfirming?: boolean
    /**
     * A deposit arrived short of the charge: what the charge booked and what it
     * asked, in dollars (TASK-23856). The card states it in place of the user
     * card, offers `onDone` as the exit, and clears the address status so the
     * poll sees the next transfer to the same address.
     */
    shortDeposit?: { received: string; asked: string }
    /** Exit for a payer who stops after a short deposit; shown as a Done button. */
    onDone?: () => void
}

const RhinoDepositView = ({
    onBack,
    chainType,
    setChainType,
    depositAddressData,
    isDepositAddressDataLoading,
    headerTitle,
    onSuccess,
    showUserCard = false,
    amount,
    tokenAmount,
    identifier,
    isConfirming = false,
    shortDeposit,
    onDone,
}: RhinoDepositViewProps) => {
    const t = useTranslations('addMoney.crypto')
    const tAddMoney = useTranslations('addMoney')
    const tCommon = useTranslations('common')
    const tPayment = useTranslations('payment')
    const {
        status: depositAddressStatus,
        resetStatus,
        isResetting,
    } = useCryptoDepositPolling(depositAddressData?.depositAddress, onSuccess)

    const amountLimitsTitle = chainType === 'EVM' ? t('evmNetworks') : NETWORK_LABELS[chainType]

    // Rhino reports one deposit per address, and its status stays "completed"
    // until it is cleared. After a short deposit, the same clear the
    // market-moved retry uses re-arms the poll for the rest, and again after
    // every read-back that leaves the card short: a top-up Rhino reported
    // before the API booked it must not leave the next transfer unseen.
    const shortDepositReceived = shortDeposit?.received
    useEffect(() => {
        if (shortDepositReceived === undefined || isConfirming) return
        resetStatus().catch(() => {
            // the clear failed: the next transfer still books on the backend,
            // and the payer finds it in Activity
        })
    }, [shortDepositReceived, isConfirming, resetStatus])

    /*
     * Fixed-amount flows (request payments pass `amount`) below the chain's SDA
     * floor must be blocked here, where the per-chain floor is first known:
     * Rhino accepts a sub-minimum deposit on-chain but never bridges it, so the
     * funds strand uncredited. The chain tabs stay usable — another chain may
     * have a lower floor.
     */
    const isBelowMinDeposit =
        amount != null && isBelowRhinoMinDeposit(amount.toString(), depositAddressData?.minDepositLimitUsd)

    if (depositAddressStatus === 'failed') {
        return (
            <PageStack>
                <NavHeader title={headerTitle} onPrev={onBack} />

                <PageStack.Center className="items-center gap-4">
                    <Card>
                        <div className="flex w-full flex-col items-center justify-center gap-2">
                            <IconBubble icon="alert" size="s" color="yellow" />
                            <h1 className="text-heading-card text-foreground-primary">{t('marketMovedTitle')}</h1>

                            <p className="text-center text-body-s text-foreground-secondary">
                                {t('marketMovedDescription')}
                            </p>

                            <p className="text-center text-label-l text-foreground-secondary">{t('marketMovedNote')}</p>
                        </div>
                    </Card>
                    <Button onClick={resetStatus} shadowSize="4" loading={isResetting} disabled={isResetting}>
                        {tCommon('tryAgain')}
                    </Button>
                </PageStack.Center>
            </PageStack>
        )
    }

    // deposit detected and settling — the processing state owns the whole
    // screen; the network toggle and instructions must not invite another
    // deposit while this one confirms
    if (depositAddressStatus === 'loading' || isConfirming) {
        return (
            <PageStack>
                {/* no way back while the payment is being booked: the flow would
                    land on the amount screen with its buttons still busy */}
                <NavHeader title={headerTitle} onPrev={onBack} hideBackBtn={isConfirming} />
                <ProcessingScreen
                    title={tAddMoney('processingDepositTitle')}
                    description={tAddMoney('processingDepositBody')}
                />
            </PageStack>
        )
    }

    return (
        <PageStack>
            <NavHeader title={headerTitle} onPrev={onBack} />

            <PageStack.Center className="items-center gap-4">
                {shortDeposit && (
                    <Card>
                        <div className="flex w-full flex-col items-center justify-center gap-2">
                            <IconBubble icon="alert" size="s" color="yellow" />
                            <h1 className="text-center text-heading-card text-foreground-primary">
                                {tPayment('partialContribution.title', {
                                    received: formatBankAmount(shortDeposit.received, 'USD'),
                                    asked: formatBankAmount(shortDeposit.asked, 'USD'),
                                })}
                            </h1>
                            <p className="text-center text-body-s text-foreground-secondary">
                                {tPayment('partialContribution.description', {
                                    remaining: formatBankAmount(
                                        Math.max(Number(shortDeposit.asked) - Number(shortDeposit.received), 0),
                                        'USD'
                                    ),
                                })}
                            </p>
                        </div>
                    </Card>
                )}
                {showUserCard && !shortDeposit && (
                    <UserCard
                        recipientType={isCryptoAddress(identifier ?? '') ? 'ADDRESS' : 'USERNAME'}
                        type="request_fulfilment"
                        username={
                            isCryptoAddress(identifier ?? '') ? printableAddress(identifier ?? '') : (identifier ?? '')
                        }
                        amount={amount}
                        tokenAmount={tokenAmount}
                        // a wallet or network fee taken from the deposit leaves the charge partly paid
                        amountNote={t('sendExtraForFees')}
                    />
                )}
                <Tabs
                    tabs={[
                        { value: 'EVM', label: 'EVM' },
                        { value: 'SOL', label: 'Solana' },
                        { value: 'TRON', label: 'Tron' },
                    ]}
                    value={chainType}
                    onValueChange={(v) => setChainType(v as RhinoChainType)}
                    fullWidth="stretch"
                    aria-label={t('selectNetworkType')}
                />

                {/* address preparation keeps the bare mascot */}
                {isDepositAddressDataLoading && (
                    <div className="flex h-screen-60 items-center justify-center">
                        <Loading variant="mascot" />
                    </div>
                )}

                {depositAddressData && !isDepositAddressDataLoading && isBelowMinDeposit && (
                    <Card>
                        <div className="flex w-full flex-col items-center justify-center gap-2">
                            <IconBubble icon="alert" color="yellow" size="s" />
                            <h1 className="text-heading-card">{tPayment('minAmount.title')}</h1>
                            <p className="text-center text-body-s text-foreground-secondary">
                                {tPayment('minAmount.description', {
                                    minAmount: depositAddressData.minDepositLimitUsd,
                                })}
                            </p>
                        </div>
                    </Card>
                )}

                {depositAddressData && !isDepositAddressDataLoading && !isBelowMinDeposit && (
                    <>
                        <div className="flex items-center justify-center">
                            <QRCodeWrapper url={depositAddressData?.depositAddress} />
                        </div>

                        <CopyField text={depositAddressData.depositAddress} />

                        <Callout priority="attention">
                            <div className="flex items-center gap-2">
                                <p>{t('supportedTokensInline')}</p>
                                {getSupportedTokens(chainType).map((token) => (
                                    <ChainChip key={token.name} chainName={token.name} chainSymbol={token.logoUrl} />
                                ))}
                            </div>
                        </Callout>

                        <div className="flex w-full flex-col gap-1">
                            <div className="flex w-full items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <p className="text-body-s text-foreground-secondary">
                                        {t('minDepositForLabel', { network: amountLimitsTitle })}
                                    </p>
                                </div>

                                <p className="text-body-s text-foreground-secondary">
                                    {depositAddressData.minDepositLimitUsd} USD
                                </p>
                            </div>

                            <div className="flex w-full items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <p className="text-body-s text-foreground-secondary">
                                        {t('maxDepositForLabel', { network: amountLimitsTitle })}
                                    </p>
                                </div>

                                <p className="text-body-s text-foreground-secondary">
                                    {depositAddressData.maxDepositLimitUsd} USD
                                </p>
                            </div>
                        </div>

                        {chainType === 'EVM' && (
                            <Card className="flex flex-col gap-2 p-4">
                                <h3 className="text-label-l text-foreground-primary">{t('supportedEvmNetworks')}</h3>
                                <div className="flex flex-wrap gap-2">
                                    {SUPPORTED_EVM_CHAINS.map((chain) => (
                                        <ChainChip key={chain} chainName={chain} chainSymbol={CHAIN_LOGOS[chain]} />
                                    ))}
                                </div>
                            </Card>
                        )}
                    </>
                )}

                {shortDeposit && onDone && (
                    <Button variant="primary" className="w-full" onClick={onDone}>
                        {tCommon('done')}
                    </Button>
                )}
            </PageStack.Center>
        </PageStack>
    )
}

export default RhinoDepositView
