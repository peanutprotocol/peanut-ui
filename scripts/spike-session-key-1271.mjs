/*
 * Fork-simulation proof for the SESSION_KEY_SPEND design (one-tap mixed).
 *
 * Proves, against a mainnet-state fork, the assumptions the ephemeral spend
 * key stands on (src/utils/ephemeralSpendKey.ts):
 *
 * Scenario A — permission WITHOUT self-uninstall:
 *   A1. ENABLE-DURING-VALIDATION: one UserOp installs the permission (enable
 *       signature from sudo) AND executes a batch signed by the ephemeral key.
 *   A2. CallPolicy rejects an out-of-scope call.
 *   A3. ERC-1271 accepted from the SignatureCallerPolicy's allowed caller.
 *   A4. ERC-1271 rejected from any other caller.
 *   A5. KNOWN LIMITATION (this is why the self-uninstall exists): the
 *       TimestampPolicy does NOT expire the 1271 path — reported as WARN.
 *
 * Scenario B — production shape, batch ends with uninstallValidation(self):
 *   B1. The op executes (enable + batch + self-uninstall in one UserOp).
 *   B2. Afterwards the 1271 path is dead even for the allowed caller — the
 *       ephemeral key's authority does not outlive its own transaction.
 *
 * The sudo validator here is ECDSA (a passkey can't sign headlessly); the
 * enable/permission plumbing is identical to production's passkey sudo.
 *
 * Run:
 *   anvil --fork-url $ARBITRUM_RPC_URL --port 8545
 *   node scripts/spike-session-key-1271.mjs
 *
 * Env: RPC_URL (default http://127.0.0.1:8545). Exits non-zero when a PASS
 * assertion fails. No bundler needed: UserOps self-execute via
 * entryPoint.handleOps from an anvil-funded EOA.
 */
import {
    concatHex,
    createPublicClient,
    createWalletClient,
    http,
    encodeFunctionData,
    erc20Abi,
    hashTypedData,
    pad,
    parseAbi,
    toFunctionSelector,
    toHex,
} from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { toPackedUserOperation } from 'viem/account-abstraction'
import { arbitrum } from 'viem/chains'
import { createKernelAccount, KernelV3AccountAbi } from '@zerodev/sdk'
import { getEntryPoint, KERNEL_V3_1 } from '@zerodev/sdk/constants'
import { signerToEcdsaValidator } from '@zerodev/ecdsa-validator'
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

const RPC_URL = process.env.RPC_URL ?? 'http://127.0.0.1:8545'
const USDC = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' // Arbitrum One native USDC
const ENTRY_POINT = getEntryPoint('0.7')
const ALLOWED_CALLER = '0x00000000000000000000000000000000000a11c4'
const RECIPIENT = '0x0000000000000000000000000000000000001234'
/*
 * Longer than production's 180s on purpose: this script runs through a slow
 * public-RPC fork and its setup can exceed 3 minutes, at which point the
 * TimestampPolicy (correctly) expires the UserOp and scenario A reverts —
 * observed as intermittent A1 failures. Incidentally that flake IS evidence
 * the TTL binds the UserOp path; A5 shows it does not bind the 1271 path.
 */
const TTL_SECONDS = 1800

// anvil default account #0
const EXECUTOR_PK = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'

const entryPointAbi = parseAbi([
    'function handleOps((address sender,uint256 nonce,bytes initCode,bytes callData,bytes32 accountGasLimits,uint256 preVerificationGas,bytes32 gasFees,bytes paymasterAndData,bytes signature)[] ops, address payable beneficiary)',
])
const erc1271Abi = parseAbi(['function isValidSignature(bytes32 hash, bytes signature) view returns (bytes4)'])
const ERC1271_MAGIC = '0x1626ba7e'

const transferSelector = toFunctionSelector(parseAbi(['function transfer(address,uint256) returns (bool)'])[0])
const uninstallSelector = toFunctionSelector(
    'function uninstallValidation(bytes21 vId, bytes deinitData, bytes hookDeinitData)'
)

const publicClient = createPublicClient({ chain: arbitrum, transport: http(RPC_URL) })
const executor = privateKeyToAccount(EXECUTOR_PK)
const walletClient = createWalletClient({ account: executor, chain: arbitrum, transport: http(RPC_URL) })

const results = []
const record = (name, ok, detail = '') => {
    results.push({ name, ok, warnOnly: false })
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}
const warn = (name, triggered, detail = '') => {
    results.push({ name, ok: true, warnOnly: true })
    console.log(`${triggered ? 'WARN' : 'INFO'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

const rpc = (method, params) => publicClient.request({ method, params })

const transferCall = (to) => ({
    to: USDC,
    value: 0n,
    data: encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [to, 0n] }),
})

/** Fresh sudo + ephemeral keys, permission with the standard policy set. */
async function buildSession({ withUninstallPermission }) {
    const sudoSigner = privateKeyToAccount(generatePrivateKey())
    const ephemeral = privateKeyToAccount(generatePrivateKey())
    const sudoValidator = await signerToEcdsaValidator(publicClient, {
        signer: sudoSigner,
        entryPoint: ENTRY_POINT,
        kernelVersion: KERNEL_V3_1,
    })
    // The address derives from the sudo validator alone — probe it first so
    // the uninstall permission can pin the account as its own target.
    const probe = await createKernelAccount(publicClient, {
        entryPoint: ENTRY_POINT,
        kernelVersion: KERNEL_V3_1,
        plugins: { sudo: sudoValidator },
    })
    const accountAddress = probe.address

    const now = Number((await publicClient.getBlock()).timestamp)
    const permissions = [
        {
            target: USDC,
            selector: transferSelector,
            rules: [
                { condition: ParamCondition.EQUAL, offset: 0, params: [pad(RECIPIENT, { size: 32 })] },
                { condition: ParamCondition.LESS_THAN_OR_EQUAL, offset: 32, params: [pad(toHex(0n), { size: 32 })] },
            ],
        },
    ]
    if (withUninstallPermission) permissions.push({ target: accountAddress, selector: uninstallSelector })

    const permissionPlugin = await toPermissionValidator(publicClient, {
        entryPoint: ENTRY_POINT,
        kernelVersion: KERNEL_V3_1,
        signer: await toECDSASigner({ signer: ephemeral }),
        policies: [
            await toCallPolicy({
                policyVersion: CallPolicyVersion.V0_0_4,
                policyFlag: PolicyFlags.NOT_FOR_VALIDATE_SIG,
                permissions,
            }),
            await toSignatureCallerPolicy({
                policyFlag: PolicyFlags.NOT_FOR_VALIDATE_USEROP,
                allowedCallers: [ALLOWED_CALLER],
            }),
            await toTimestampPolicy({ validAfter: 0, validUntil: now + TTL_SECONDS }),
            await toRateLimitPolicy({ policyFlag: PolicyFlags.NOT_FOR_VALIDATE_SIG, count: 1 }),
        ],
    })

    const account = await createKernelAccount(publicClient, {
        entryPoint: ENTRY_POINT,
        kernelVersion: KERNEL_V3_1,
        plugins: { sudo: sudoValidator, regular: permissionPlugin },
    })
    if (account.address !== accountAddress) throw new Error('probe address mismatch — spike assumption broken')

    await rpc('anvil_setBalance', [account.address, toHex(10n ** 18n)])
    return { account, permissionPlugin, accountAddress }
}

async function buildOp(account, calls) {
    const factoryArgs = await account.getFactoryArgs()
    const op = {
        sender: account.address,
        nonce: await account.getNonce(),
        factory: factoryArgs.factory,
        factoryData: factoryArgs.factoryData,
        callData: await account.encodeCalls(calls),
        callGasLimit: 1_500_000n,
        verificationGasLimit: 2_000_000n,
        preVerificationGas: 500_000n,
        maxFeePerGas: 100_000_000n,
        maxPriorityFeePerGas: 1_000_000n,
        signature: '0x',
    }
    op.signature = await account.signUserOperation(op)
    return toPackedUserOperation(op)
}

async function sendOp(packed) {
    // anvil on an Arbitrum fork over-deducts sender balance far beyond the
    // receipt's gasUsed × effectiveGasPrice (L1-fee accounting quirk) — top the
    // executor up before every send or the second send starves.
    await rpc('anvil_setBalance', [executor.address, toHex(10n ** 21n)])
    const hash = await walletClient.writeContract({
        address: ENTRY_POINT.address,
        abi: entryPointAbi,
        functionName: 'handleOps',
        args: [[packed], executor.address],
        gas: 6_000_000n,
    })
    return publicClient.waitForTransactionReceipt({ hash })
}

const rainTypedData = {
    domain: { name: 'Collateral', version: '2', chainId: arbitrum.id, verifyingContract: ALLOWED_CALLER },
    types: { Withdraw: [{ name: 'nonce', type: 'uint256' }] },
    primaryType: 'Withdraw',
    message: { nonce: 1n },
}

async function check1271(account, sig, from) {
    try {
        const magic = await publicClient.readContract({
            address: account.address,
            abi: erc1271Abi,
            functionName: 'isValidSignature',
            args: [hashTypedData(rainTypedData), sig],
            account: from,
        })
        return magic === ERC1271_MAGIC
    } catch {
        return false
    }
}

async function main() {
    await rpc('anvil_setBalance', [executor.address, toHex(10n ** 21n)])

    // ── Scenario A ────────────────────────────────────────────────────────
    console.log('— Scenario A: no self-uninstall —')
    const a = await buildSession({ withUninstallPermission: false })

    // A2 first (simulation only, no state change): out-of-scope recipient.
    try {
        const badOp = await buildOp(a.account, [transferCall('0x000000000000000000000000000000000000dEaD')])
        await publicClient.simulateContract({
            account: executor,
            address: ENTRY_POINT.address,
            abi: entryPointAbi,
            functionName: 'handleOps',
            args: [[badOp], executor.address],
        })
        record('A2 CallPolicy rejects out-of-scope recipient', false, 'simulation unexpectedly succeeded')
    } catch {
        record('A2 CallPolicy rejects out-of-scope recipient', true)
    }

    let receipt = await sendOp(await buildOp(a.account, [transferCall(RECIPIENT)]))
    record(
        'A1 enable-during-validation + session-signed batch executes',
        receipt.status === 'success',
        receipt.transactionHash
    )

    const sigA = await a.account.signTypedData(rainTypedData)
    record('A3 1271 accepted from allowed caller', await check1271(a.account, sigA, ALLOWED_CALLER))
    record('A4 1271 REJECTED from disallowed caller', !(await check1271(a.account, sigA, executor.address)))

    await rpc('evm_increaseTime', [TTL_SECONDS + 60])
    await rpc('evm_mine', [])
    const aliveAfterExpiry = await check1271(a.account, sigA, ALLOWED_CALLER)
    warn(
        'A5 TimestampPolicy does NOT expire the 1271 path (why the self-uninstall exists)',
        aliveAfterExpiry,
        aliveAfterExpiry
            ? 'still valid after expiry, as expected'
            : 'unexpectedly expired — self-uninstall may be redundant'
    )

    // ── Scenario B ────────────────────────────────────────────────────────
    console.log('— Scenario B: production shape (batch ends in self-uninstall) —')
    const b = await buildSession({ withUninstallPermission: true })
    const uninstallCall = {
        to: b.accountAddress,
        value: 0n,
        data: encodeFunctionData({
            abi: KernelV3AccountAbi,
            functionName: 'uninstallValidation',
            args: [
                concatHex(['0x02', pad(b.permissionPlugin.getIdentifier(), { size: 20, dir: 'right' })]),
                await b.permissionPlugin.getEnableData(b.accountAddress),
                '0x',
            ],
        }),
    }
    // Sign the 1271 payload BEFORE the op so B2 tests a signature that was
    // valid while the permission lived.
    const sigB = await b.account.signTypedData(rainTypedData)

    receipt = await sendOp(await buildOp(b.account, [transferCall(RECIPIENT), uninstallCall]))
    record('B1 enable + batch + self-uninstall in one UserOp executes', receipt.status === 'success')
    record(
        'B2 1271 dead after the op, even for the allowed caller',
        !(await check1271(b.account, sigB, ALLOWED_CALLER))
    )

    const failed = results.filter((r) => !r.ok)
    console.log(`\n${results.length - failed.length}/${results.length} checks ok`)
    process.exit(failed.length === 0 ? 0 : 1)
}

main().catch((e) => {
    console.error(e)
    process.exit(1)
})
