'use client'

/**
 * Passkey wallet rescue — a login-bypassing recovery surface.
 *
 * Some early smart wallets (pre the signup test-transaction guard) ended up in a
 * state where the user's device can still authenticate their passkey, but the
 * ZeroDev passkey-SERVER login round-trip fails ("unexpected error"), so they
 * can never reach the app to move their funds. The account is fine on-chain and
 * is controlled by a passkey whose public key we persist server-side.
 *
 * This page rebuilds the kernel client straight from that stored pubkey
 * (bypassing the broken login), proves it derives to the expected wallet
 * address, and lets the user sign one withdrawal with their device. The private
 * key never leaves their authenticator, so the worst a bad/forged link can do is
 * fail to sign — it can never move anyone else's funds.
 *
 * Reached only via an ops-generated link: /recover-wallet?k=<base64url-blob>.
 * Must run on the production origin (peanut.me) — the browser keys WebAuthn to
 * the page domain, so the device only finds the credential there.
 */

import { Button } from '@/components/0_Bruddle/Button'
import AddressLink from '@/components/Global/AddressLink'
import Card from '@/components/Global/Card'
import ErrorAlert from '@/components/Global/ErrorAlert'
import GeneralRecipientInput, { type GeneralRecipientUpdate } from '@/components/Global/GeneralRecipientInput'
import { Icon } from '@/components/Global/Icons/Icon'
import PeanutLoading from '@/components/Global/PeanutLoading'
import { PUBLIC_CLIENTS_BY_CHAIN } from '@/app/actions/clients'
import { createKernelClientForChain, type KernelClientOptions } from '@/context/kernelClient.context'
import {
    PEANUT_WALLET_CHAIN,
    PEANUT_WALLET_TOKEN,
    PEANUT_WALLET_TOKEN_DECIMALS,
    PEANUT_WALLET_TOKEN_SYMBOL,
} from '@/constants/zerodev.consts'
import { type RecipientState } from '@/context/WithdrawFlowContext'
import { areEvmAddressesEqual, getExplorerUrl, isTxReverted } from '@/utils/general.utils'
import { decodeRecoveryKey, toRescueWebAuthnKey, type RecoveryKeyInput } from '@/utils/walletRescue.utils'
import { captureException } from '@sentry/nextjs'
import { useSearchParams } from 'next/navigation'
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { type Address, encodeFunctionData, erc20Abi, formatUnits, isAddress } from 'viem'

type Phase = 'loading' | 'invalid' | 'ready' | 'final'
type RescueClient = Awaited<ReturnType<typeof createKernelClientForChain>>

// useSearchParams requires a Suspense boundary to keep the route from forcing
// the whole tree dynamic at build time.
export default function RecoverWalletPage() {
    return (
        <Suspense fallback={<PeanutLoading />}>
            <RecoverWalletInner />
        </Suspense>
    )
}

function RecoverWalletInner() {
    const searchParams = useSearchParams()
    const blob = searchParams.get('k')

    const recoveryKey = useMemo<RecoveryKeyInput | null>(() => {
        if (!blob) return null
        try {
            return decodeRecoveryKey(blob)
        } catch {
            return null
        }
    }, [blob])

    const [phase, setPhase] = useState<Phase>('loading')
    const [fatal, setFatal] = useState<string>('')
    const [client, setClient] = useState<RescueClient | null>(null)
    const [balance, setBalance] = useState<bigint>(0n)
    const [recipient, setRecipient] = useState<RecipientState>({ address: '', name: '' })
    const [inputChanging, setInputChanging] = useState(false)
    const [recipientError, setRecipientError] = useState('')
    const [isSigning, setIsSigning] = useState(false)
    const [signError, setSignError] = useState('')
    const [txHash, setTxHash] = useState<string>('')

    const chainId = PEANUT_WALLET_CHAIN.id.toString()
    const formattedBalance = formatUnits(balance, PEANUT_WALLET_TOKEN_DECIMALS)

    // Build the kernel client from the stored pubkey, prove it derives to the
    // expected address, and read the on-chain USDC balance.
    useEffect(() => {
        if (!recoveryKey) {
            setPhase('invalid')
            setFatal('This recovery link is invalid or has expired. Please ask support for a fresh one.')
            return
        }
        // name MUST be undefined, not '' — GeneralRecipientInput shows
        // `recipient.name ?? recipient.address`, and ?? only falls through on
        // null/undefined, so an empty-string name would hide the prefilled
        // destination while still enabling the button (invisible target).
        if (recoveryKey.to) setRecipient({ address: recoveryKey.to, name: undefined })

        let cancelled = false
        ;(async () => {
            try {
                const entry = PUBLIC_CLIENTS_BY_CHAIN[chainId]
                if (!entry) throw new Error(`chain ${chainId} not configured`)
                const options: KernelClientOptions = {
                    bundlerUrl: entry.bundlerUrl,
                    paymasterUrl: entry.paymasterUrl,
                }
                const builtClient = await createKernelClientForChain(
                    entry.client,
                    entry.chain,
                    // Affected wallets all post-date the ZeroDev migration, so they
                    // use the plain (non-migration) kernel. A pre-migration key
                    // would derive a different address and trip the guard below.
                    true,
                    toRescueWebAuthnKey(recoveryKey),
                    undefined,
                    options
                )
                const derived = builtClient.account!.address
                if (!areEvmAddressesEqual(derived, recoveryKey.address)) {
                    throw new Error(`derived ${derived} != expected ${recoveryKey.address}`)
                }
                const onChainBalance = await entry.client.readContract({
                    address: PEANUT_WALLET_TOKEN as Address,
                    abi: erc20Abi,
                    functionName: 'balanceOf',
                    args: [recoveryKey.address],
                })
                if (cancelled) return
                // Keep the proven client so signing reuses the asserted account
                // rather than rebuilding (and re-deriving) it.
                setClient(builtClient)
                setBalance(onChainBalance)
                setPhase('ready')
            } catch (error) {
                console.error('[recover-wallet] init failed', error)
                captureException(error, { tags: { error_type: 'wallet_rescue_init' } })
                if (cancelled) return
                setPhase('invalid')
                setFatal('We could not load this wallet for recovery. Please contact support.')
            }
        })()
        return () => {
            cancelled = true
        }
    }, [recoveryKey, chainId])

    const recover = useCallback(async () => {
        // `client` is the address-asserted client built at init — reuse it so we
        // never sign from an unverified re-derivation.
        if (!client || !isAddress(recipient.address) || balance <= 0n) return
        setIsSigning(true)
        setSignError('')
        try {
            const data = encodeFunctionData({
                abi: erc20Abi,
                functionName: 'transfer',
                args: [recipient.address as Address, balance],
            })
            const userOpHash = await client.sendUserOperation({
                account: client.account,
                callData: await client.account!.encodeCalls([{ to: PEANUT_WALLET_TOKEN as Address, value: 0n, data }]),
            })
            const receipt = await client.waitForUserOperationReceipt({ hash: userOpHash })
            if (receipt.receipt && isTxReverted(receipt.receipt)) {
                throw new Error('transaction reverted')
            }
            setTxHash(receipt.receipt?.transactionHash ?? userOpHash)
            setPhase('final')
        } catch (error) {
            console.error('[recover-wallet] sign failed', error)
            captureException(error, { tags: { error_type: 'wallet_rescue_send' } })
            setSignError('We could not complete the recovery. Please retry, or contact support if it keeps failing.')
        } finally {
            setIsSigning(false)
        }
    }, [client, recipient.address, balance])

    if (phase === 'loading') return <PeanutLoading />

    if (phase === 'invalid') {
        return (
            <div className="flex min-h-[inherit] flex-col gap-8">
                <div className="my-auto flex flex-col gap-6">
                    <h1 className="text-2xl font-extrabold">Wallet recovery</h1>
                    <ErrorAlert description={fatal} />
                </div>
            </div>
        )
    }

    if (phase === 'final') {
        return (
            <div className="flex min-h-[inherit] flex-col gap-8">
                <div className="my-auto flex flex-col gap-6">
                    <h1 className="text-2xl font-extrabold">Funds on the way 🎉</h1>
                    <Card className="flex flex-col gap-1 p-4">
                        <span className="text-sm text-grey-1">
                            Sent to <AddressLink address={recipient.address} />
                        </span>
                        <span className="text-2xl font-extrabold">
                            {formattedBalance} {PEANUT_WALLET_TOKEN_SYMBOL}
                        </span>
                        <a
                            href={`${getExplorerUrl(chainId)}/tx/${txHash}`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-2 text-black underline"
                        >
                            <span>View on explorer</span>
                            <Icon name="external-link" size={20} />
                        </a>
                    </Card>
                </div>
            </div>
        )
    }

    // phase === 'ready'
    const nothingToRecover = balance <= 0n
    return (
        <div className="flex min-h-[inherit] flex-col gap-8">
            <div className="my-auto flex flex-col gap-6">
                <div className="flex flex-col gap-1">
                    <h1 className="text-2xl font-extrabold">
                        {recoveryKey?.label ? `${recoveryKey.label}, let's` : "Let's"} recover your funds
                    </h1>
                    <p className="text-sm text-grey-1">
                        Sign with the passkey on this device to move your balance to any address.
                    </p>
                </div>

                <Card className="flex flex-col gap-1 p-4">
                    <span className="text-sm text-grey-1">
                        Wallet <AddressLink address={recoveryKey!.address} />
                    </span>
                    <span className="text-2xl font-extrabold">
                        {formattedBalance} {PEANUT_WALLET_TOKEN_SYMBOL}
                    </span>
                </Card>

                {nothingToRecover ? (
                    <ErrorAlert description="This wallet has no recoverable balance." />
                ) : (
                    <>
                        <GeneralRecipientInput
                            placeholder="Address to receive the funds"
                            recipient={recipient}
                            onUpdate={(update: GeneralRecipientUpdate) => {
                                setRecipient(update.recipient)
                                setRecipientError(update.errorMessage)
                                setInputChanging(update.isChanging)
                            }}
                        />
                        <Button
                            variant="purple"
                            shadowSize="4"
                            onClick={recover}
                            disabled={!!recipientError || inputChanging || !isAddress(recipient.address) || isSigning}
                            loading={isSigning}
                            className="w-full"
                        >
                            {isSigning ? 'Confirm on your device…' : 'Recover funds'}
                        </Button>
                        {!!signError && <ErrorAlert description={signError} />}
                    </>
                )}
            </div>
        </div>
    )
}
