import type { Address, Chain, Hex, PublicClient } from 'viem'
import { withCeremonyPurpose } from '@/utils/webauthn-ceremony-telemetry'
import { http, pad, slice, toFunctionSelector, toHex } from 'viem'
import type { KernelValidator } from '@zerodev/sdk/types'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { PolicyFlags, toPermissionValidator } from '@zerodev/permissions'
import {
    CallPolicyVersion,
    ParamCondition,
    toCallPolicy,
    toRateLimitPolicy,
    toSignatureCallerPolicy,
    toTimestampPolicy,
} from '@zerodev/permissions/policies'
import { toECDSASigner } from '@zerodev/permissions/signers'
import { concatHex, encodeFunctionData } from 'viem'
import {
    accountMetadata,
    createKernelAccount,
    createKernelAccountClient,
    createZeroDevPaymasterClient,
    getPluginsEnableTypedData,
    KernelV3AccountAbi,
} from '@zerodev/sdk'
import { getEntryPoint, KERNEL_V3_1 } from '@zerodev/sdk/constants'
import {
    assertZeroDevRpcUrls,
    BUNDLER_URL,
    PAYMASTER_URL,
    PEANUT_WALLET_CHAIN,
    PEANUT_WALLET_TOKEN,
    ZERODEV_RPC_TIMEOUT_MS,
} from '@/constants/zerodev.consts'
import { rainCoordinatorAbi } from '@/constants/rain.consts'

/*
 * Per-transaction ephemeral session key for the one-tap mixed spend.
 *
 * One passkey tap signs a permission-enable for a throwaway ECDSA key whose
 * authority is enforced ON-CHAIN by the kernel's permission validator, scoped
 * to exactly one spend:
 *   - CallPolicy pinned to the batch's targets/selectors, with amount/recipient
 *     rules on the ERC20 legs and the withdrawAsset static args
 *     (NOT_FOR_VALIDATE_SIG: it has no calldata to check on the 1271 path)
 *   - SignatureCallerPolicy pinning WHO may consume the key's ERC-1271
 *     signatures — Rain's contracts only (NOT_FOR_VALIDATE_USEROP)
 *   - TimestampPolicy: the whole permission dies after TTL_SECONDS, UserOps
 *     and 1271 signatures alike
 *   - RateLimitPolicy count 1 (NOT_FOR_VALIDATE_SIG): a single UserOp, ever
 *   - SELF-DESTRUCTION: the batch's last call MUST be `uninstallCall` — the
 *     kernel uninstalls this very permission at the end of the same UserOp.
 *     Fork-proven necessity: the TimestampPolicy does NOT expire the ERC-1271
 *     path (scripts/spike-session-key-1271.mjs), so without the uninstall a
 *     leaked key would keep admin-signature capability forever. The uninstall
 *     permission is pinned to target+selector only (its vId argument is the
 *     permission's own id — a hash of these very policies, so pinning it is
 *     circular); the residual exposure is a mid-TTL attacker uninstalling
 *     ANOTHER validator (e.g. the Rain server grant) — a recoverable DoS,
 *     not theft, and the root validator is not uninstallable via this path.
 *
 * The key itself lives only in this closure's memory for the duration of one
 * spend — it is never serialized, persisted, or sent anywhere. dispose()
 * zeroes the reference.
 *
 * The enable signature is computed manually against the LIVE validator nonce
 * and injected via `pluginEnableSignature` — the SDK's internal enable path
 * silently falls back to nonce 1 on any read failure, which mints a dead
 * approval (the AA23 class useGrantSessionKey works around the same way).
 */

const TTL_SECONDS = 180

const ERC20_TRANSFER_SELECTOR = toFunctionSelector('function transfer(address,uint256) returns (bool)')
const ERC20_APPROVE_SELECTOR = toFunctionSelector('function approve(address,uint256) returns (bool)')

export interface EphemeralCall {
    to: Address
    value?: bigint
    data: Hex
}

export interface EphemeralSpendScope {
    /** The user's deployed kernel account (forced address, like the grant). */
    accountAddress: Address
    /** The exact batch the key may sign. Targets/selectors are pinned from it. */
    calls: EphemeralCall[]
    /** Cap for the withdrawAsset _amountNative arg (the collateral shortfall). */
    withdrawAmountCap: bigint
    collateralProxy: Address
    coordinatorAddress: Address
}

export class EphemeralKeyPreflightError extends Error {
    constructor(message: string, opts?: { cause?: unknown }) {
        super(message, opts)
        this.name = 'EphemeralKeyPreflightError'
    }
}

type PermissionShape = {
    target: Address
    selector: Hex
    rules?: { condition: ParamCondition; offset: number; params: Hex[] }[]
}

/**
 * Derives the CallPolicy permission list from the concrete batch. ERC20
 * transfer/approve get exact recipient + amount-cap rules; withdrawAsset gets
 * its four leading static args pinned (proxy, asset, amount ≤ shortfall,
 * recipient = the kernel itself); anything else is pinned to target+selector.
 * Duplicate (target, selector) pairs collapse to the first occurrence — the
 * policy contract ORs permissions, so repeats add nothing.
 */
export function derivePermissions(scope: EphemeralSpendScope): PermissionShape[] {
    const seen = new Set<string>()
    const permissions: PermissionShape[] = []

    for (const call of scope.calls) {
        if (!call.data || call.data.length < 10) {
            throw new EphemeralKeyPreflightError('ephemeral key: refusing to scope a call without a selector')
        }
        const selector = slice(call.data, 0, 4)
        const key = `${call.to.toLowerCase()}:${selector}`
        if (seen.has(key)) continue
        seen.add(key)

        if (call.to.toLowerCase() === scope.coordinatorAddress.toLowerCase()) {
            permissions.push({
                target: scope.coordinatorAddress,
                selector: toFunctionSelector(rainCoordinatorAbi[0]),
                rules: [
                    { condition: ParamCondition.EQUAL, offset: 0, params: [pad(scope.collateralProxy, { size: 32 })] },
                    {
                        condition: ParamCondition.EQUAL,
                        offset: 32,
                        params: [pad(PEANUT_WALLET_TOKEN as Address, { size: 32 })],
                    },
                    {
                        condition: ParamCondition.LESS_THAN_OR_EQUAL,
                        offset: 64,
                        params: [pad(toHex(scope.withdrawAmountCap), { size: 32 })],
                    },
                    { condition: ParamCondition.EQUAL, offset: 96, params: [pad(scope.accountAddress, { size: 32 })] },
                ],
            })
            continue
        }

        if (selector === ERC20_TRANSFER_SELECTOR || selector === ERC20_APPROVE_SELECTOR) {
            // Both share the (address,uint256) shape — pin the counterparty
            // exactly and cap the amount at what this batch actually moves.
            const counterparty = slice(call.data, 4 + 12, 4 + 32)
            const amount = slice(call.data, 4 + 32, 4 + 64)
            permissions.push({
                target: call.to,
                selector,
                rules: [
                    { condition: ParamCondition.EQUAL, offset: 0, params: [pad(counterparty, { size: 32 })] },
                    { condition: ParamCondition.LESS_THAN_OR_EQUAL, offset: 32, params: [amount] },
                ],
            })
            continue
        }

        permissions.push({ target: call.to, selector })
    }

    return permissions
}

export interface EphemeralSpendSession {
    /** Kernel account whose regular validator is the scoped ephemeral permission. */
    account: Awaited<ReturnType<typeof createKernelAccount>>
    /** Kernel client wired to the same bundler/paymaster as the main client. */
    client: ReturnType<typeof createKernelAccountClient>
    /** Self-destruct call — MUST be the last call of the batch. */
    uninstallCall: EphemeralCall
    /** Drop the key material. Call in a finally. */
    dispose: () => void
}

/**
 * Builds the scoped session account + client. The ONE passkey prompt of the
 * whole spend happens inside this function (the enable-typed-data signature);
 * everything signed afterwards — the Rain admin EIP-712 and the UserOp — comes
 * from the in-memory ephemeral key, silently.
 *
 * Throws EphemeralKeyPreflightError for every failure in here: nothing has
 * been broadcast yet, so the caller can safely fall back to the passkey path.
 */
export async function createEphemeralSpendSession(args: {
    publicClient: PublicClient
    chain: Chain
    scope: EphemeralSpendScope
    /** From useKernelClient().getPatchedSudoValidator — NEVER the plugin-manager internal. */
    patchedSudoValidator: KernelValidator
    /** Permission lifetime. Sign-only flows hand the op to the backend to
     *  broadcast and need more than the broadcasting default. */
    ttlSeconds?: number
}): Promise<EphemeralSpendSession> {
    const { publicClient, chain, scope, patchedSudoValidator, ttlSeconds = TTL_SECONDS } = args
    assertZeroDevRpcUrls(BUNDLER_URL, PAYMASTER_URL)

    try {
        let privateKey: Hex | null = generatePrivateKey()
        const ephemeralAccount = privateKeyToAccount(privateKey)
        const now = Math.floor(Date.now() / 1000)

        const uninstallSelector = toFunctionSelector(
            'function uninstallValidation(bytes21 vId, bytes deinitData, bytes hookDeinitData)'
        )
        const callPolicy = await toCallPolicy({
            policyVersion: CallPolicyVersion.V0_0_4,
            // The call policy has no calldata to inspect on the ERC-1271 path —
            // left at the default FOR_ALL_VALIDATION it would fail every
            // signature check (which is what the SignatureCallerPolicy is for).
            policyFlag: PolicyFlags.NOT_FOR_VALIDATE_SIG,
            permissions: [
                ...derivePermissions(scope),
                // The self-destruct call (see module doc — vId can't be pinned).
                { target: scope.accountAddress, selector: uninstallSelector },
            ],
        })
        const signatureCallerPolicy = await toSignatureCallerPolicy({
            policyFlag: PolicyFlags.NOT_FOR_VALIDATE_USEROP,
            // Whichever Rain contract runs SignatureChecker over the admin sig.
            allowedCallers: [scope.collateralProxy, scope.coordinatorAddress],
        })
        // FOR_ALL_VALIDATION on purpose: expiry must kill the 1271 path too,
        // or a leaked key could authorize withdrawals long after the flow.
        const timestampPolicy = await toTimestampPolicy({ validAfter: 0, validUntil: now + ttlSeconds })
        const rateLimitPolicy = await toRateLimitPolicy({
            policyFlag: PolicyFlags.NOT_FOR_VALIDATE_SIG,
            count: 1,
        })

        const signer = await toECDSASigner({ signer: ephemeralAccount })
        const permissionPlugin = await toPermissionValidator(publicClient, {
            entryPoint: getEntryPoint('0.7'),
            kernelVersion: KERNEL_V3_1,
            signer,
            policies: [callPolicy, signatureCallerPolicy, timestampPolicy, rateLimitPolicy],
        })

        // Forced address, exactly like the grant: the permission must bind to
        // the user's deployed kernel, not a counterfactual derivation.
        const [sessionAccount, metadata, currentNonce, validNonceFrom] = await Promise.all([
            createKernelAccount(publicClient, {
                address: scope.accountAddress,
                entryPoint: getEntryPoint('0.7'),
                kernelVersion: KERNEL_V3_1,
                plugins: {
                    sudo: patchedSudoValidator,
                    regular: permissionPlugin,
                },
            }),
            accountMetadata(publicClient, scope.accountAddress, KERNEL_V3_1, chain.id),
            publicClient.readContract({
                address: scope.accountAddress,
                abi: KernelV3AccountAbi,
                functionName: 'currentNonce',
            }),
            publicClient.readContract({
                address: scope.accountAddress,
                abi: KernelV3AccountAbi,
                functionName: 'validNonceFrom',
            }),
        ])

        /*
         * Live-nonce binding, fail-loud. Unlike the grant flow this path takes
         * NO repair action (no migration, no invalidateNonce) — those cost
         * extra passkey taps, defeating the point. An account that needs them
         * throws here and the caller falls back to the 2-tap passkey path,
         * where the grant flow's own repairs apply.
         */
        const nonce = Number(currentNonce)
        const floor = Number(validNonceFrom)
        if (floor > Math.max(nonce, 1)) {
            throw new EphemeralKeyPreflightError('ephemeral key: validator nonce floored — needs repair, fall back')
        }
        const validatorNonce = nonce === 0 ? 1 : nonce

        type AccountInternals = {
            kernelPluginManager: {
                getAction: () => Parameters<typeof getPluginsEnableTypedData>[0]['action']
                hook: Parameters<typeof getPluginsEnableTypedData>[0]['hook']
            }
        }
        const pm = (sessionAccount as unknown as AccountInternals).kernelPluginManager
        const enableTypedData = await getPluginsEnableTypedData({
            accountAddress: sessionAccount.address,
            chainId: chain.id,
            kernelVersion: metadata.version,
            action: pm.getAction(),
            hook: pm.hook,
            validator: permissionPlugin,
            validatorNonce,
        })

        // THE passkey tap.
        const enableSignature = await withCeremonyPurpose('ephemeral_enable', () =>
            patchedSudoValidator.signTypedData(enableTypedData)
        )

        // Rebuild the account with the precomputed enable signature injected so
        // the SDK's enable-mode UserOp encoding uses OUR nonce-verified
        // signature instead of internally re-deriving one via getKernelV3Nonce
        // (whose silent nonce-1 fallback mints dead approvals).
        const armedAccount = await createKernelAccount(publicClient, {
            address: scope.accountAddress,
            entryPoint: getEntryPoint('0.7'),
            kernelVersion: KERNEL_V3_1,
            plugins: {
                sudo: patchedSudoValidator,
                regular: permissionPlugin,
                pluginEnableSignature: enableSignature,
            },
        })

        const isMainnetPeanutChain = chain.id.toString() === PEANUT_WALLET_CHAIN.id.toString() && chain.id === 42161
        const client = createKernelAccountClient({
            account: armedAccount,
            chain,
            bundlerTransport: http(BUNDLER_URL, { timeout: ZERODEV_RPC_TIMEOUT_MS }),
            pollingInterval: 500,
            userOperation: isMainnetPeanutChain
                ? {
                      // UltraRelay shortcut — same as the main client.
                      estimateFeesPerGas: async () => ({ maxFeePerGas: BigInt(0), maxPriorityFeePerGas: BigInt(0) }),
                  }
                : undefined,
            paymaster: {
                getPaymasterData: async (userOperation) => {
                    const zerodevPaymaster = createZeroDevPaymasterClient({
                        chain,
                        transport: http(PAYMASTER_URL, { timeout: ZERODEV_RPC_TIMEOUT_MS }),
                    })
                    return zerodevPaymaster.sponsorUserOperation({ userOperation, shouldOverrideFee: true })
                },
            },
        })

        // Same encoding as the SDK's uninstallPlugin action: vId is the
        // validator type byte + the 4-byte permissionId right-padded to 20.
        const uninstallCall: EphemeralCall = {
            to: scope.accountAddress,
            value: 0n,
            data: encodeFunctionData({
                abi: KernelV3AccountAbi,
                functionName: 'uninstallValidation',
                args: [
                    concatHex(['0x02', pad(permissionPlugin.getIdentifier(), { size: 20, dir: 'right' })]),
                    await permissionPlugin.getEnableData(scope.accountAddress),
                    '0x',
                ],
            }),
        }

        return {
            account: armedAccount,
            client,
            uninstallCall,
            dispose: () => {
                privateKey = null
            },
        }
    } catch (e) {
        if (e instanceof EphemeralKeyPreflightError) throw e
        throw new EphemeralKeyPreflightError('ephemeral key: session setup failed', { cause: e })
    }
}
