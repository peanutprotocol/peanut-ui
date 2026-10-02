import type { Address, Hex, LocalAccount } from 'viem'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { PEANUT_WALLET_CHAIN } from '@/constants/zerodev.consts'
import { toPermissionValidator, serializePermissionAccount } from '@zerodev/permissions'
import { toECDSASigner } from '@zerodev/permissions/signers'
import { accountMetadata, createKernelAccount, getPluginsEnableTypedData, KernelV3AccountAbi } from '@zerodev/sdk'
import { getEntryPoint, KERNEL_V3_1 } from '@zerodev/sdk/constants'
import { withCeremonyPurpose } from '@/utils/webauthn-ceremony-telemetry'
import { peanutPublicClient } from '@/app/actions/clients'
import { ensureRootValidatorMigrated, isMigrationWrapperAccount } from '@/utils/kernelMigration.utils'
import { repairEnableNonce, type NoncePublicClient } from '@/utils/kernelNonceRepair.utils'
import { beginKernelSigning } from '@/utils/kernelSigningGuard'
import type { useKernelClient } from '@/context/kernelClient.context'
import type { useZeroDev } from '@/hooks/useZeroDev'

/** Minimal structural view of the bits of the kernel account's plugin manager
 *  this flow touches. The SDK doesn't surface these on its public account type,
 *  so we model just what we use rather than reaching through `any`.
 *  `getAction`/`hook` are typed from `getPluginsEnableTypedData`'s own
 *  parameter so the enable-typed-data call stays fully checked. */
type EnableTypedDataParams = Parameters<typeof getPluginsEnableTypedData>[0]
type KernelAccountInternals = {
    kernelPluginManager: {
        getAction: () => EnableTypedDataParams['action']
        hook: EnableTypedDataParams['hook']
    }
}

type PermissionPolicies = Parameters<typeof toPermissionValidator>[1]['policies']

/**
 * Frontend doesn't hold the session-key private key (backend does).
 * `toECDSASigner` only reads `.address` off the signer for permission
 * install, so a minimal LocalAccount that throws on any sign attempt
 * is sufficient and protects against misuse.
 */
function remoteSignerByAddress(address: Address): LocalAccount {
    const throwSign = () => {
        throw new Error('Session-key remote signer cannot sign on the frontend — backend owns the private key')
    }
    return {
        address,
        type: 'local',
        source: 'remote-session-key',
        publicKey: '0x' as Hex,
        signMessage: throwSign,
        signTransaction: throwSign,
        signTypedData: throwSign,
    } as unknown as LocalAccount
}

/** The connected kernel is not the wallet the permission must be built for. */
export class PermissionWalletMismatchError extends Error {
    constructor() {
        super('The connected wallet is not the wallet this permission is for')
        this.name = 'PermissionWalletMismatchError'
    }
}

export interface SignKernelPermissionArgs {
    /** The one call policy this permission is built from. */
    policies: PermissionPolicies
    /** Session signer the backend holds the key for. */
    sessionKeyAddress: Address
    /** When set, signing aborts unless the connected kernel is exactly this wallet. */
    expectedAccount?: Address
    kernel: Pick<
        ReturnType<typeof useKernelClient>,
        'ensureClientForChain' | 'getPatchedSudoValidator' | 'rebuildClientForChain'
    >
    sendUserOp: ReturnType<typeof useZeroDev>['handleSendUserOpEncoded']
}

/**
 * Signs one scoped session-key permission with the user's passkey and returns
 * it serialized. Shared by every grant that installs a `CallPolicy` permission
 * on the user's kernel (withdrawals, managed card funding); the caller only
 * chooses the policy.
 *
 * The enable signature is bound to the kernel's LIVE `currentNonce`, read
 * here and never defaulted: the SDK's own `getKernelV3Nonce` silently falls
 * back to `1` on any read failure, and the SDK's `isEnabled` ignores the
 * `validNonceFrom` floor, so neither can be trusted to produce a usable
 * approval. Passing our own signature to `serializePermissionAccount` keeps
 * that path fully explicit and fail-closed.
 */
export async function signKernelPermission(args: SignKernelPermissionArgs): Promise<string> {
    // Open until the signature is made: a card permission migration must not
    // raise the nonce floor under an enable signature bound to the old one.
    // Throws `KernelSigningBusyError` while a migration runs.
    const release = beginKernelSigning()
    try {
        return await signKernelPermissionUnguarded(args)
    } finally {
        release()
    }
}

async function signKernelPermissionUnguarded(args: SignKernelPermissionArgs): Promise<string> {
    const { policies, sessionKeyAddress, expectedAccount, kernel, sendUserOp } = args
    const { ensureClientForChain, getPatchedSudoValidator, rebuildClientForChain } = kernel

    const sessionKeySigner = await toECDSASigner({
        signer: remoteSignerByAddress(sessionKeyAddress),
    })
    const permissionPlugin = await toPermissionValidator(peanutPublicClient, {
        entryPoint: getEntryPoint('0.7'),
        kernelVersion: KERNEL_V3_1,
        signer: sessionKeySigner,
        policies,
    })

    const chainId = PEANUT_WALLET_CHAIN.id.toString()
    const kernelClient = await ensureClientForChain(chainId)
    if (expectedAccount && kernelClient.account?.address?.toLowerCase() !== expectedAccount.toLowerCase()) {
        throw new PermissionWalletMismatchError()
    }
    // Fired here (not at wrap-entry) so the denominator excludes the early
    // returns that never produce a passkey prompt.
    posthog.capture(ANALYTICS_EVENTS.CARD_SESSION_KEY_PROMPTED)
    // The serialized approval's sudo plugin MUST bind to the v0.0.3 PATCHED
    // validator. Do NOT read `kernelClient.account.kernelPluginManager
    // .sudoValidator`: for a pre-2025-09-18 (migrated) user that resolves to
    // the STALE v0.0.2 validator the migration client was constructed with
    // (`sudo: fromValidator`), so the backend's replayed sweep/withdraw
    // userOp gets wapk-403'd by ZeroDev's paymaster. `getPatchedSudoValidator`
    // is the single source of truth — the same v0.0.3 validator the migration
    // client migrates *to* — so the approval binds correctly for every user.
    const patchedSudoValidator = await getPatchedSudoValidator(peanutPublicClient)

    // Triggers the passkey prompt — this is the one-time install.
    // `address` is forced to the user's actual wallet so the approval
    // binds to the deployed kernel. Pre-2025-09-18 users sit at a
    // legacy V0_0_2-derived address (migrated in place to V0_0_3); the
    // natural counterfactual of `createKernelAccount({sudo: patchedSudoValidator})`
    // is a different, never-funded address. Forcing the address here makes
    // the grant work for both legacy and post-migration users.
    const accountAddress = kernelClient.account!.address
    // The four on-chain reads only need the (already-known) account address,
    // so they run alongside the account construction.
    const [sessionKernelAccount, bytecode, metadata, nonceRead, floorRead] = await Promise.all([
        createKernelAccount(peanutPublicClient, {
            address: accountAddress,
            entryPoint: getEntryPoint('0.7'),
            kernelVersion: KERNEL_V3_1,
            plugins: {
                sudo: patchedSudoValidator,
                regular: permissionPlugin,
            },
        }),
        peanutPublicClient.getCode({ address: accountAddress }),
        // Live on-chain EIP-712 domain version, KERNEL_V3_1 fallback when the
        // account can't report one — the same resolution the SDK's internal
        // enable path uses (a hardcoded version signs the wrong domain for any
        // kernel not exactly on that version).
        accountMetadata(peanutPublicClient, accountAddress, KERNEL_V3_1, PEANUT_WALLET_CHAIN.id),
        peanutPublicClient
            .readContract({ address: accountAddress, abi: KernelV3AccountAbi, functionName: 'currentNonce' })
            .then(
                (nonce) => ({ read: true as const, nonce: Number(nonce) }),
                (error: unknown) => ({ read: false as const, error })
            ),
        peanutPublicClient
            .readContract({ address: accountAddress, abi: KernelV3AccountAbi, functionName: 'validNonceFrom' })
            .then(
                (floor) => ({ read: true as const, floor: Number(floor) }),
                (error: unknown) => ({ read: false as const, error })
            ),
    ])

    // The session-key permission installs on-chain via an "enable" approval the
    // passkey signs here, bound to the account's `currentNonce` — the kernel
    // rejects the enable with `AA23 InvalidNonce` if the signed value ≠ its live
    // value, and the grant still "succeeds", so the card then declines forever.
    // The SDK's internal `getKernelV3Nonce` silently falls back to `1` on ANY
    // read failure, which mints exactly that broken approval for accounts whose
    // live nonce ≠ 1 (e.g. migrated / sudo-changed accounts). Bind to the
    // verified live nonce instead, and only fall back where 1 is provably
    // correct: a counterfactual account, whose kernel initializes
    // `currentNonce` to 1 at deployment (the read itself reverts pre-deploy).
    let validatorNonce: number
    if (!bytecode) {
        if (isMigrationWrapperAccount(kernelClient.account)) {
            // Undeployed PRE-cutoff account: the serialized approval would bake
            // a v0.0.3 initCode that derives a different CREATE2 address than
            // this wallet, so every backend replay reverts AA14. Deploy first
            // via the hardened migration gate — it verifies the root-validator
            // swap against ON-CHAIN ground truth (a reverted migration inside a
            // successful bundle would otherwise deploy the account on v0.0.2
            // and the approval signed below would be silently dead) and hands
            // back a rebuilt client. One extra passkey tap.
            await ensureRootValidatorMigrated({
                client: kernelClient,
                sendNoopUserOp: (call) => sendUserOp([call], chainId, { returnRevertedReceipt: true }),
                rebuildClient: () => rebuildClientForChain(chainId),
            })
            // Freshly deployed: read the live nonce; fail loud if unreadable.
            const freshNonce = await peanutPublicClient.readContract({
                address: accountAddress,
                abi: KernelV3AccountAbi,
                functionName: 'currentNonce',
            })
            validatorNonce = Math.max(Number(freshNonce), 1)
            posthog.capture(ANALYTICS_EVENTS.CARD_SESSION_KEY_PREFLIGHT_REPAIR, { mode: 'deploy' })
        } else {
            // Post-cutoff counterfactual: the kernel initializes currentNonce
            // to 1 at deployment, so 1 is provably exact.
            validatorNonce = 1
        }
    } else if (!nonceRead.read) {
        // Deployed but unreadable: fail LOUDLY rather than sign a guess.
        throw nonceRead.error
    } else if (floorRead.read && floorRead.floor > Math.max(nonceRead.nonce, 1)) {
        // validNonceFrom AHEAD of currentNonce — the 2025-09-18 migration-wave
        // state. Every enable-mode install lands below the floor and reverts
        // InvalidNonce forever, so an approval signed now would be dead on
        // arrival. Repair inline (one extra passkey tap: invalidateNonce
        // syncs the counter up to the floor), then bind the fresh nonce.
        validatorNonce = (
            await repairEnableNonce({
                // viem's generic readContract collapses structural
                // assignability to the minimal client interface.
                publicClient: peanutPublicClient as unknown as NoncePublicClient,
                accountAddress,
                validNonceFrom: floorRead.floor,
                sendUserOp: (call) => sendUserOp([call], chainId),
            })
        ).validatorNonce
        posthog.capture(ANALYTICS_EVENTS.CARD_SESSION_KEY_PREFLIGHT_REPAIR, { mode: 'invalidate' })
    } else {
        if (!floorRead.read) {
            // Don't regress every healthy grant on one flaky read: proceed on
            // the old (pre-floor-check) behavior and flag it — a floored
            // account slipping through here still gets caught by the sweep's
            // permanent-failure path and /fix-card-signature.
            posthog.capture(ANALYTICS_EVENTS.CARD_SESSION_KEY_PREFLIGHT_REPAIR, { mode: 'floor-read-failed' })
        }
        // A deployed-but-uninitialized proxy reports 0; enables validate
        // against ≥1 post-init, so normalize the way the SDK does.
        validatorNonce = nonceRead.nonce === 0 ? 1 : nonceRead.nonce
    }

    const pm = (sessionKernelAccount as unknown as KernelAccountInternals).kernelPluginManager
    const enableTypedData = await getPluginsEnableTypedData({
        accountAddress: sessionKernelAccount.address,
        chainId: PEANUT_WALLET_CHAIN.id,
        kernelVersion: metadata.version,
        action: pm.getAction(),
        hook: pm.hook,
        validator: permissionPlugin,
        validatorNonce,
    })
    // Same sudo validator + signing path the SDK uses internally, so for
    // healthy nonce=1 accounts this yields an identical approval.
    const enableSignature = await withCeremonyPurpose('session_key_grant', () =>
        patchedSudoValidator.signTypedData(enableTypedData)
    )

    return serializePermissionAccount(sessionKernelAccount, undefined, enableSignature)
}
