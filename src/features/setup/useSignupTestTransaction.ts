'use client'

import { useCallback } from 'react'
import { captureMessage } from '@sentry/nextjs'
import { decodeAbiParameters, encodeFunctionData, erc20Abi, type Address, type Hash, type Hex } from 'viem'
import {
    formatUserOperationRequest,
    getUserOperationHash,
    type RpcUserOperation,
    type UserOperation,
} from 'viem/account-abstraction'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN } from '@/constants/zerodev.consts'
import { useAuth } from '@/context/authContext'
import { useKernelClient } from '@/context/kernelClient.context'
import { zeroDevFlowActions } from '@/hooks/useZeroDevFlow'
import { isDemoMode } from '@/utils/demo'
import { reportPasskeyFailure } from '@/utils/passkey-failure-reporting'
import { userOpRevertedError } from '@/utils/userop-rescue.utils'
import {
    sendSignedUserOperation,
    SIGNUP_TEST_TX_SUBMISSION,
    submitSignedUserOperation,
    userOpFailureKind,
    type SubmissionBudget,
    type UserOpReceiptResult,
} from '@/utils/userop-submission'
import { capturePasskeySignFailure } from '@/utils/webauthn.utils'
import { withCeremonyPurpose } from '@/utils/webauthn-ceremony-telemetry'
import { checkPasskeyUserOpSignature } from '@/utils/webauthn-userop-signature'
import { SignupTestTxError } from './signup-test-tx-error'
import {
    readSignupTestTransaction,
    saveSignupTestTransaction,
    clearSignupTestTransaction,
    updateSignupTestTransaction,
    type SignupTestTransaction,
} from './signup-test-transaction'

/** The validator the device check mirrors: v0.0.3 PATCHED, the one every new account uses. */
const PASSKEY_VALIDATOR_V0_0_3 = '0x7ab16ff354acb328452f1d445b3ddee9a91e9e69'

export interface SignupTestTxClient {
    chainId: number
    sender: Address
    entryPoint: { address: Address; version: '0.7' }
    encodeCalls: (calls: { to: Address; value: bigint; data: Hex }[]) => Promise<Hex>
    prepare: (callData: Hex) => Promise<UserOperation<'0.7'>>
    sign: (userOperation: UserOperation<'0.7'>) => Promise<Hex>
    /** The passkey behind the account's validator, or null when it is not the v0.0.3 passkey validator. */
    publicKey: () => Promise<{ x: bigint; y: bigint } | null>
    send: (userOperation: RpcUserOperation, entryPoint: Address) => Promise<Hash>
    waitForReceipt: (hash: Hash, timeoutMs: number) => Promise<UserOpReceiptResult>
    getReceipt: (hash: Hash) => Promise<UserOpReceiptResult | null>
    /** The account's next nonce is past this one: some operation at this nonce landed. */
    nonceSpent: (nonce: bigint) => Promise<boolean>
}

export interface SignupTestTxResult {
    userOpHash: Hash
    /** No passkey prompt: an operation signed earlier was sent again. */
    reusedSignature: boolean
    sends: number
    recovered: string[]
}

const testCalls = (sender: Address) => [
    {
        to: PEANUT_WALLET_TOKEN as Address,
        value: 0n,
        data: encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [sender, 0n] }),
    },
]

async function signTestOperation(
    userId: string,
    client: SignupTestTxClient,
    previous: SignupTestTransaction | null,
    now: () => number
): Promise<SignupTestTransaction> {
    let prepared: UserOperation<'0.7'>
    try {
        prepared = await client.prepare(await client.encodeCalls(testCalls(client.sender)))
    } catch (error) {
        throw new SignupTestTxError('prepare', error)
    }
    let signature: Hex
    try {
        signature = await client.sign(prepared)
    } catch (error) {
        throw new SignupTestTxError('sign', error)
    }
    const signed = { ...prepared, signature }
    const userOpHash = getUserOperationHash({
        userOperation: signed,
        entryPointAddress: client.entryPoint.address,
        entryPointVersion: client.entryPoint.version,
        chainId: client.chainId,
    })
    const publicKey = await client.publicKey().catch(() => null)
    const check = publicKey ? checkPasskeyUserOpSignature({ signature, userOpHash, publicKey }) : null
    const record: SignupTestTransaction = {
        chainId: client.chainId,
        sender: client.sender,
        entryPoint: client.entryPoint.address,
        userOpHash,
        userOperation: formatUserOperationRequest(signed),
        signatureCheck: !check ? 'unverifiable' : check.valid ? 'valid' : check.reason,
        signatureRejected: false,
        needsNewSignature: false,
        transientFailures: previous?.transientFailures ?? 0,
        mined: false,
        deferred: false,
        deferredRetries: 0,
        signedAt: now(),
    }
    // Saved before the first send: a reload from here on resends this operation, never a new one.
    saveSignupTestTransaction(userId, record)
    return record
}

/**
 * The final signup step's test operation: a zero-value token transfer to the
 * account itself, signed with the new passkey. An operation signed earlier and
 * not yet confirmed is sent again as is, without a passkey prompt; a new
 * signature is asked for only when none exists or the old one can no longer be
 * included (its sponsorship expired or its nonce is spent).
 */
export async function runSignupTestTransaction({
    userId,
    client,
    budget = SIGNUP_TEST_TX_SUBMISSION,
    now = Date.now,
    sleep,
}: {
    userId: string
    client: SignupTestTxClient
    budget?: SubmissionBudget
    now?: () => number
    sleep?: (ms: number) => Promise<void>
}): Promise<SignupTestTxResult> {
    let record = readSignupTestTransaction(userId)
    if (record && (record.sender.toLowerCase() !== client.sender.toLowerCase() || record.chainId !== client.chainId)) {
        clearSignupTestTransaction(userId)
        record = null
    }
    if (record?.mined) return { userOpHash: record.userOpHash, reusedSignature: true, sends: 0, recovered: [] }

    const reusedSignature = !!record && !record.needsNewSignature
    if (!record || record.needsNewSignature) record = await signTestOperation(userId, client, record, now)
    const op = record

    try {
        const outcome = await submitSignedUserOperation(
            op.userOpHash,
            {
                send: () => client.send(op.userOperation, op.entryPoint),
                waitForReceipt: client.waitForReceipt,
                getReceipt: client.getReceipt,
                // Every operation this account can have at this nonce is a signup test operation signed by this passkey.
                nonceSpent: () => client.nonceSpent(BigInt(op.userOperation.nonce)),
                sleep,
                now,
            },
            budget
        )
        if (!outcome.success) {
            updateSignupTestTransaction(userId, { needsNewSignature: true })
            throw userOpRevertedError(outcome.userOpHash, outcome.success)
        }
        updateSignupTestTransaction(userId, { mined: true, userOpHash: outcome.userOpHash })
        if (op.signatureCheck !== 'valid' && op.signatureCheck !== 'unverifiable') {
            captureMessage('Signup test operation mined although the device signature check rejected it', {
                level: 'warning',
                tags: { error_type: 'signup_signature_check_mismatch' },
                extra: { signatureCheck: op.signatureCheck },
            })
        }
        return { userOpHash: outcome.userOpHash, reusedSignature, sends: outcome.sends, recovered: outcome.recovered }
    } catch (error) {
        const kind = userOpFailureKind(error)
        if (kind === 'signature_invalid') updateSignupTestTransaction(userId, { signatureRejected: true })
        else if (kind === 'expired' || kind === 'nonce_used')
            updateSignupTestTransaction(userId, { needsNewSignature: true })
        else if (kind === 'transient') {
            updateSignupTestTransaction(userId, { transientFailures: op.transientFailures + 1 })
        }
        throw new SignupTestTxError('submit', error, op.signatureCheck)
    }
}

type KernelClient = ReturnType<ReturnType<typeof useKernelClient>['getClientForChain']>

interface PasskeyValidatorLike {
    address?: string
    source?: string
    getEnableData?: (accountAddress?: Address) => Promise<Hex>
}

export function kernelSignupTestTxClient(client: KernelClient): SignupTestTxClient {
    const account = client.account!
    return {
        chainId: client.chain.id,
        sender: account.address,
        entryPoint: account.entryPoint as SignupTestTxClient['entryPoint'],
        encodeCalls: (calls) => account.encodeCalls(calls),
        prepare: async (callData) =>
            (await client.prepareUserOperation({ account, callData })) as unknown as UserOperation<'0.7'>,
        sign: (userOperation) =>
            withCeremonyPurpose('user_op', () =>
                account.signUserOperation(userOperation as Parameters<typeof account.signUserOperation>[0])
            ),
        publicKey: async () => {
            const validator = (account as { kernelPluginManager?: { sudoValidator?: PasskeyValidatorLike } })
                .kernelPluginManager?.sudoValidator
            if (
                !validator?.getEnableData ||
                validator.source !== 'WebAuthnValidator' ||
                validator.address?.toLowerCase() !== PASSKEY_VALIDATOR_V0_0_3
            ) {
                return null
            }
            const [{ x, y }] = decodeAbiParameters(
                [
                    {
                        type: 'tuple',
                        components: [
                            { name: 'x', type: 'uint256' },
                            { name: 'y', type: 'uint256' },
                        ],
                    },
                    { type: 'bytes32' },
                ],
                await validator.getEnableData(account.address)
            )
            return { x, y }
        },
        send: (userOperation, entryPoint) => sendSignedUserOperation(client, userOperation, entryPoint),
        waitForReceipt: (hash, timeout) => client.waitForUserOperationReceipt({ hash, timeout }),
        getReceipt: (hash) =>
            client.getUserOperationReceipt({ hash }).catch((error: unknown) => {
                if ((error as Error)?.name === 'UserOperationReceiptNotFoundError') return null
                throw error
            }),
        nonceSpent: async (nonce) => (await account.getNonce()) > nonce,
    }
}

const DEMO_USEROP_HASH = `0x${'de'.repeat(32)}` as Hash

export function useSignupTestTransaction() {
    const { ensureClientForChain, getClientForChain } = useKernelClient()
    const { user } = useAuth()
    const userId = user?.user.userId

    const sendTestTransaction = useCallback(async (): Promise<SignupTestTxResult> => {
        if (isDemoMode()) {
            await new Promise((resolve) => setTimeout(resolve, 600))
            return { userOpHash: DEMO_USEROP_HASH, reusedSignature: false, sends: 0, recovered: [] }
        }
        if (!userId) throw new SignupTestTxError('prepare', new Error('User not loaded'))
        const chainId = PEANUT_WALLET_CHAIN.id.toString()
        let client: KernelClient
        try {
            await ensureClientForChain(chainId)
            client = getClientForChain(chainId)
        } catch (error) {
            throw new SignupTestTxError('prepare', error)
        }
        zeroDevFlowActions.setIsSendingUserOp(true)
        try {
            return await runSignupTestTransaction({ userId, client: kernelSignupTestTxClient(client) })
        } catch (error) {
            if (error instanceof SignupTestTxError && error.phase === 'sign') {
                reportPasskeyFailure(error.cause, 'send-user-op')
                capturePasskeySignFailure(error.cause, 'send-user-op')
            }
            throw error
        } finally {
            zeroDevFlowActions.setIsSendingUserOp(false)
        }
    }, [ensureClientForChain, getClientForChain, userId])

    return { sendTestTransaction }
}
