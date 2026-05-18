'use client'

/**
 * One-off dev page: call `addAdmin(_admin, _salts, _signatures)` on a Rain
 * collateral proxy. Used to add prod's wallet as an admin on the prod
 * collateral proxy from STAGING (because staging's wallet is the existing
 * admin on the shared proxy and the contract's `addAdmin` gate requires
 * msg.sender to already be an admin).
 *
 * DELETE THIS FILE after the one-off — it's gated to dev/staging trees but
 * still shouldn't ship to prod.
 *
 * Mode A — Auto: page reads `adminNonce`, asks you to sign an EIP-712
 *   message of shape `AddAdmin { admin: address, nonce: uint256 }` (best
 *   guess at the typed-data the proxy validates), then sends the
 *   `addAdmin` call via a kernel UserOp.
 *
 * Mode B — Manual: paste pre-computed _salts[] and _signatures[] (hex)
 *   — escape hatch if the EIP-712 type in Mode A is wrong and the tx
 *   reverts. Compute externally via `cast` against the verified
 *   implementation source at
 *   https://arbiscan.io/address/0xB1DcF74F2EFb6F6F73E89AAE56A746466a46d562B#code
 */

import { type FC, useCallback, useMemo, useState } from 'react'
import { encodeFunctionData, isAddress, type Address, type Hex } from 'viem'
import { useKernelClient } from '@/context/kernelClient.context'
import { useZeroDev } from '@/hooks/useZeroDev'
import { peanutPublicClient } from '@/app/actions/clients'
import { PEANUT_WALLET_CHAIN } from '@/constants/zerodev.consts'
import { rainCollateralAbi } from '@/constants/rain.consts'
import { Button } from '@/components/0_Bruddle/Button'

// Default targets. Override via the form inputs.
const PROD_COLLATERAL_PROXY = '0xe53febedbe3599a108259433be989a32361b1f6b' as const
const PROD_ADMIN_TO_ADD = '0xb9d77f0a3e954109ddae3c302ac56c87bad60440' as const

// Minimal ABI for addAdmin — matches the Arbiscan write-contract signature.
const addAdminAbi = [
    {
        inputs: [
            { name: '_admin', type: 'address' },
            { name: '_salts', type: 'bytes32[]' },
            { name: '_signatures', type: 'bytes[]' },
        ],
        name: 'addAdmin',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
    },
] as const

// EIP-712 type guess for the AddAdmin message. Most likely shape based on
// the withdraw pattern (admin + nonce). The salt in withdrawAsset's
// `_adminSalts[]` is the EIP-712 domain salt the proxy uses when
// `domainSeparatorV4(salt)` is recomputed for each entry. Same convention
// is assumed here.
//
// If the tx reverts on first try, the actual type lives in the implementation
// source. Update this shape OR use Manual mode below.
const RAIN_DOMAIN_NAME = 'Collateral'
const RAIN_DOMAIN_VERSION = '2'
const addAdminEip712Types = {
    AddAdmin: [
        { name: 'admin', type: 'address' },
        { name: 'nonce', type: 'uint256' },
    ],
} as const

interface TxStatus {
    kind: 'idle' | 'reading' | 'signing' | 'sending' | 'ok' | 'err'
    message?: string
}

const Status: FC<{ status: TxStatus }> = ({ status }) => {
    if (status.kind === 'idle') return null
    const colors: Record<TxStatus['kind'], string> = {
        idle: '',
        reading: 'text-grey-1',
        signing: 'text-grey-1',
        sending: 'text-grey-1',
        ok: 'text-green-1',
        err: 'text-red',
    }
    return <p className={`text-sm ${colors[status.kind]}`}>{status.message ?? status.kind}</p>
}

const RainAddAdminPage: FC = () => {
    const { getClientForChain } = useKernelClient()
    const { handleSendUserOpEncoded } = useZeroDev()

    const [proxyAddress, setProxyAddress] = useState<string>(PROD_COLLATERAL_PROXY)
    const [newAdmin, setNewAdmin] = useState<string>(PROD_ADMIN_TO_ADD)
    const [adminNonce, setAdminNonce] = useState<bigint | null>(null)
    const [saltHex, setSaltHex] = useState<string>('')
    const [signatureHex, setSignatureHex] = useState<string>('')
    const [status, setStatus] = useState<TxStatus>({ kind: 'idle' })
    const [lastTxHash, setLastTxHash] = useState<Hex | null>(null)

    const inputsValid = useMemo(() => isAddress(proxyAddress) && isAddress(newAdmin), [proxyAddress, newAdmin])

    const readAdminNonce = useCallback(async () => {
        if (!isAddress(proxyAddress)) {
            setStatus({ kind: 'err', message: 'Proxy address invalid' })
            return null
        }
        setStatus({ kind: 'reading', message: 'Reading adminNonce…' })
        try {
            const nonce = await peanutPublicClient.readContract({
                address: proxyAddress as Address,
                abi: rainCollateralAbi,
                functionName: 'adminNonce',
            })
            setAdminNonce(nonce)
            setStatus({ kind: 'idle' })
            return nonce
        } catch (err) {
            setStatus({ kind: 'err', message: `Read failed: ${(err as Error).message}` })
            return null
        }
    }, [proxyAddress])

    // Mode A — auto: sign the guessed EIP-712 then submit via kernel UserOp.
    const handleAutoSubmit = useCallback(async () => {
        if (!inputsValid) {
            setStatus({ kind: 'err', message: 'Inputs invalid' })
            return
        }
        // Random salt — proxies typically allow any caller-supplied salt
        // and use it as the EIP-712 domain salt entry for the signature.
        const salt =
            `0x${crypto.getRandomValues(new Uint8Array(32)).reduce((s, b) => s + b.toString(16).padStart(2, '0'), '')}` as Hex

        const nonce = adminNonce ?? (await readAdminNonce())
        if (nonce == null) return

        const chainIdNum = PEANUT_WALLET_CHAIN.id
        const chainIdStr = chainIdNum.toString()
        const kernelClient = getClientForChain(chainIdStr)

        setStatus({ kind: 'signing', message: 'Tap passkey to sign EIP-712…' })
        let signature: Hex
        try {
            signature = (await kernelClient.account!.signTypedData({
                domain: {
                    name: RAIN_DOMAIN_NAME,
                    version: RAIN_DOMAIN_VERSION,
                    chainId: chainIdNum,
                    verifyingContract: proxyAddress as Address,
                    salt,
                },
                types: addAdminEip712Types,
                primaryType: 'AddAdmin',
                message: {
                    admin: newAdmin as Address,
                    nonce,
                },
            })) as Hex
        } catch (err) {
            setStatus({ kind: 'err', message: `Sign rejected: ${(err as Error).message}` })
            return
        }

        await sendAddAdmin(proxyAddress as Address, newAdmin as Address, [salt], [signature], chainIdStr)
    }, [inputsValid, adminNonce, readAdminNonce, getClientForChain, proxyAddress, newAdmin])

    // Mode B — manual: caller pre-computed salt + sig externally.
    const handleManualSubmit = useCallback(async () => {
        if (!inputsValid) {
            setStatus({ kind: 'err', message: 'Inputs invalid' })
            return
        }
        if (!/^0x[0-9a-fA-F]{64}$/.test(saltHex)) {
            setStatus({ kind: 'err', message: 'Salt must be 0x + 64 hex chars (bytes32)' })
            return
        }
        if (!/^0x[0-9a-fA-F]+$/.test(signatureHex)) {
            setStatus({ kind: 'err', message: 'Signature must be 0x-prefixed hex' })
            return
        }
        const chainIdStr = PEANUT_WALLET_CHAIN.id.toString()
        await sendAddAdmin(
            proxyAddress as Address,
            newAdmin as Address,
            [saltHex as Hex],
            [signatureHex as Hex],
            chainIdStr
        )
    }, [inputsValid, saltHex, signatureHex, proxyAddress, newAdmin])

    const sendAddAdmin = useCallback(
        async (proxy: Address, admin: Address, salts: Hex[], signatures: Hex[], chainIdStr: string) => {
            setStatus({ kind: 'sending', message: 'Sending UserOp (tap passkey if prompted)…' })
            try {
                const data = encodeFunctionData({
                    abi: addAdminAbi,
                    functionName: 'addAdmin',
                    args: [admin, salts, signatures],
                })
                const { userOpHash, receipt } = await handleSendUserOpEncoded(
                    [{ to: proxy, value: 0n, data }],
                    chainIdStr
                )
                const txHash = (receipt?.transactionHash ?? userOpHash) as Hex
                setLastTxHash(txHash)
                setStatus({
                    kind: 'ok',
                    message: `Sent. tx: ${txHash}`,
                })
            } catch (err) {
                setStatus({ kind: 'err', message: `Send failed: ${(err as Error).message}` })
            }
        },
        [handleSendUserOpEncoded]
    )

    return (
        <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
            <header className="flex flex-col gap-1">
                <h1 className="text-2xl font-black">Rain collateral — addAdmin</h1>
                <p className="text-sm text-grey-1">
                    One-off tool to add a new admin to a Rain collateral proxy. Run from a wallet that is already an
                    admin on the proxy. Delete this page after use.
                </p>
            </header>

            <section className="flex flex-col gap-3 rounded-sm border border-n-1 p-4">
                <label className="flex flex-col gap-1">
                    <span className="text-sm font-bold">Collateral proxy</span>
                    <input
                        className="rounded-sm border border-n-1 px-3 py-2 font-mono text-sm"
                        value={proxyAddress}
                        onChange={(e) => setProxyAddress(e.target.value.trim())}
                        placeholder="0x…"
                    />
                </label>
                <label className="flex flex-col gap-1">
                    <span className="text-sm font-bold">New admin to add</span>
                    <input
                        className="rounded-sm border border-n-1 px-3 py-2 font-mono text-sm"
                        value={newAdmin}
                        onChange={(e) => setNewAdmin(e.target.value.trim())}
                        placeholder="0x…"
                    />
                </label>
                <div className="flex items-center gap-3">
                    <Button variant="stroke" onClick={readAdminNonce}>
                        Read adminNonce
                    </Button>
                    {adminNonce != null && <span className="text-sm">nonce = {adminNonce.toString()}</span>}
                </div>
            </section>

            <section className="flex flex-col gap-3 rounded-sm border border-n-1 p-4">
                <h2 className="text-lg font-extrabold">Mode A — auto sign</h2>
                <p className="text-sm text-grey-1">
                    Signs EIP-712{' '}
                    <code className="bg-grey-2 px-1">
                        AddAdmin {`{`} admin, nonce {`}`}
                    </code>{' '}
                    with your passkey, then sends the addAdmin call via a kernel UserOp. If the proxy rejects, the
                    typed-data shape is wrong — use Mode B.
                </p>
                <Button
                    variant="purple"
                    shadowSize="4"
                    onClick={handleAutoSubmit}
                    disabled={status.kind === 'signing' || status.kind === 'sending'}
                >
                    Sign & send
                </Button>
            </section>

            <section className="flex flex-col gap-3 rounded-sm border border-n-1 p-4">
                <h2 className="text-lg font-extrabold">Mode B — manual</h2>
                <p className="text-sm text-grey-1">
                    Paste pre-computed salt (bytes32) and signature (bytes). Multi-sig single-signer call.
                </p>
                <label className="flex flex-col gap-1">
                    <span className="text-sm font-bold">_salts[0] (bytes32)</span>
                    <input
                        className="rounded-sm border border-n-1 px-3 py-2 font-mono text-sm"
                        value={saltHex}
                        onChange={(e) => setSaltHex(e.target.value.trim())}
                        placeholder="0x… (64 hex chars)"
                    />
                </label>
                <label className="flex flex-col gap-1">
                    <span className="text-sm font-bold">_signatures[0] (bytes)</span>
                    <input
                        className="rounded-sm border border-n-1 px-3 py-2 font-mono text-sm"
                        value={signatureHex}
                        onChange={(e) => setSignatureHex(e.target.value.trim())}
                        placeholder="0x…"
                    />
                </label>
                <Button
                    variant="stroke"
                    onClick={handleManualSubmit}
                    disabled={status.kind === 'signing' || status.kind === 'sending'}
                >
                    Send with pasted sig
                </Button>
            </section>

            <Status status={status} />
            {lastTxHash && (
                <a
                    href={`https://arbiscan.io/tx/${lastTxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-black underline"
                >
                    View tx on Arbiscan ↗
                </a>
            )}
        </div>
    )
}

export default RainAddAdminPage
