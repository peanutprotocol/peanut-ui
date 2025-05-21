'use client'

import { Button } from '@/components/0_Bruddle'
import Card from '@/components/Global/Card'
import DisplayIcon from '@/components/Global/DisplayIcon'
import ErrorAlert from '@/components/Global/ErrorAlert'
import NavHeader from '@/components/Global/NavHeader'
import PeanutActionDetailsCard from '@/components/Global/PeanutActionDetailsCard'
import { PaymentInfoRow } from '@/components/Payment/PaymentInfoRow'
import { useTokenChainIcons } from '@/hooks/useTokenChainIcons'
import { ITokenPriceData } from '@/interfaces'
import { formatAmount, printableAddress } from '@/utils'
import { interfaces } from '@squirrel-labs/peanut-sdk'

interface WithdrawConfirmViewProps {
    amount: string
    token: ITokenPriceData
    chain: interfaces.ISquidChain & { tokens: interfaces.ISquidToken[] }
    toAddress: string
    networkFee?: string
    peanutFee?: string
    onConfirm: () => void
    onBack: () => void
    isProcessing?: boolean
    error?: string | null
}

export default function WithdrawConfirmView({
    amount,
    token,
    chain,
    toAddress,
    networkFee = '0.00',
    peanutFee = '0.00',
    onConfirm,
    onBack,
    isProcessing,
    error,
}: WithdrawConfirmViewProps) {
    const { tokenIconUrl, chainIconUrl, resolvedChainName, resolvedTokenSymbol } = useTokenChainIcons({
        chainId: chain.chainId,
        tokenAddress: token.address,
        tokenSymbol: token.symbol,
    })

    return (
        <div className="space-y-8">
            <NavHeader title="Withdraw" onPrev={onBack} />

            <div className="space-y-4">
                <PeanutActionDetailsCard
                    avatarSize="small"
                    transactionType={'WITHDRAW'}
                    recipientType="USERNAME"
                    recipientName={''}
                    amount={formatAmount(amount)}
                    tokenSymbol={token.symbol}
                />

                <Card className="rounded-sm">
                    <PaymentInfoRow
                        label="Token and network"
                        value={
                            <div className="flex items-center gap-2">
                                {token && (
                                    <div className="relative flex h-6 w-6 min-w-[24px] items-center justify-center">
                                        <DisplayIcon
                                            iconUrl={tokenIconUrl}
                                            altText={resolvedTokenSymbol || 'token'}
                                            fallbackName={resolvedTokenSymbol || 'T'}
                                            sizeClass="h-6 w-6"
                                        />
                                        {chainIconUrl && (
                                            <div className="absolute -bottom-1 -right-1">
                                                <DisplayIcon
                                                    iconUrl={chainIconUrl}
                                                    altText={resolvedChainName || 'chain'}
                                                    fallbackName={resolvedChainName || 'C'}
                                                    sizeClass="h-3.5 w-3.5"
                                                    className="rounded-full border-2 border-white dark:border-grey-4"
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}
                                <span>
                                    {resolvedTokenSymbol || token.symbol} on{' '}
                                    <span className="capitalize">{resolvedChainName || chain.axelarChainName}</span>
                                </span>
                            </div>
                        }
                    />
                    <PaymentInfoRow label="To" value={printableAddress(toAddress)} />
                    <PaymentInfoRow
                        label="Max network fee"
                        value={`$ ${networkFee}`}
                        moreInfoText="This transaction may face slippage due to token conversion or cross-chain bridging."
                    />
                    <PaymentInfoRow hideBottomBorder label="Peanut fee" value={`$ ${peanutFee}`} />
                </Card>

                <Button
                    variant="purple"
                    shadowSize="4"
                    onClick={onConfirm}
                    disabled={isProcessing}
                    loading={isProcessing}
                    className="w-full"
                >
                    {isProcessing ? 'Withdrawing...' : 'Withdraw'}
                </Button>

                {error && <ErrorAlert description={error} />}
            </div>
        </div>
    )
}
