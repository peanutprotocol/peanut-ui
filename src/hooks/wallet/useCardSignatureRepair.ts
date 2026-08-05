import { useCallback, useState } from 'react'
import type { Address } from 'viem'
import { encodeFunctionData } from 'viem'
import { KernelV3AccountAbi } from '@zerodev/sdk'
import { peanutPublicClient } from '@/app/actions/clients'
import { PEANUT_WALLET_CHAIN } from '@/constants/zerodev.consts'
import { useKernelClient } from '@/context/kernelClient.context'
import { useZeroDev } from '@/hooks/useZeroDev'
import { buildMigrationNoopCall } from '@/utils/kernelMigration.utils'

/**
 * Diagnose-and-repair for kernel accounts whose card auto-balance approval can
 * never validate, no matter how correctly it was granted:
 *
 * - `nonce-bricked`: the account's `validNonceFrom` is AHEAD of `currentNonce`
 *   (left behind by the 2025-09-18 root-validator migration wave). Kernel
 *   v3.1 rejects every enable-mode validation installed below the
 *   `validNonceFrom` floor with `InvalidNonce()` (0x756688fe), so the backend
 *   sweep fails hourly forever. Repair: a root-passkey userOp calling
 *   `invalidateNonce(validNonceFrom + 1)` on the account itself — the kernel
 *   syncs `currentNonce` up to the floor, unbricking enable mode.
 * - `undeployed`: the account is still counterfactual, and (for pre-cutoff
 *   accounts) stored approvals bake a v0.0.3 initCode that derives a different
 *   address → every replay reverts AA14. Repair: any root userOp deploys the
 *   account with its true initCode (the migration no-op — the SDK wrapper
 *   also swaps the root validator in the same op).
 *
 * After a successful repair the caller re-grants (useGrantSessionKey), which
 * signs against the fresh live nonce and re-stores the approval server-side.
 */

type CardSignatureDiagnosis =
    | { state: 'undeployed' }
    | { state: 'nonce-bricked'; currentNonce: number; validNonceFrom: number }
    | { state: 'healthy'; currentNonce: number; validNonceFrom: number }

interface RepairState {
    diagnosis: CardSignatureDiagnosis | null
    isDiagnosing: boolean
    isRepairing: boolean
    error: string | null
}

const CHAIN_ID = String(PEANUT_WALLET_CHAIN.id)
// Post-repair confirmation poll: the public RPC can lag the bundler that
// included the repair userOp (same hazard ensureRootValidatorMigrated guards).
const CONFIRM_RETRIES = 8
const CONFIRM_INTERVAL_MS = 1500
// Kernel v3.1 rejects invalidateNonce more than MAX_NONCE_INCREMENT_SIZE (10)
// above currentNonce AND at-or-below validNonceFrom — a floor further than 10
// ahead of the nonce has no valid invalidation target and needs manual repair.
const MAX_NONCE_INCREMENT_SIZE = 10

const isUserCancelled = (message: string) => {
    const m = message.toLowerCase()
    return m.includes('user rejected') || m.includes('cancelled') || m.includes('not allowed')
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function readDiagnosis(address: Address): Promise<CardSignatureDiagnosis> {
    const code = await peanutPublicClient.getCode({ address })
    if (!code || code === '0x') return { state: 'undeployed' }
    const [currentNonce, validNonceFrom] = await Promise.all([
        peanutPublicClient.readContract({ address, abi: KernelV3AccountAbi, functionName: 'currentNonce' }),
        peanutPublicClient.readContract({ address, abi: KernelV3AccountAbi, functionName: 'validNonceFrom' }),
    ])
    const cn = Number(currentNonce)
    const vnf = Number(validNonceFrom)
    return vnf > cn
        ? { state: 'nonce-bricked', currentNonce: cn, validNonceFrom: vnf }
        : { state: 'healthy', currentNonce: cn, validNonceFrom: vnf }
}

export const useCardSignatureRepair = () => {
    const { address, handleSendUserOpEncoded } = useZeroDev()
    const { rebuildClientForChain } = useKernelClient()
    const [state, setState] = useState<RepairState>({
        diagnosis: null,
        isDiagnosing: false,
        isRepairing: false,
        error: null,
    })

    const diagnose = useCallback(async (): Promise<CardSignatureDiagnosis | null> => {
        if (!address) return null
        setState((s) => ({ ...s, isDiagnosing: true, error: null }))
        try {
            const diagnosis = await readDiagnosis(address as Address)
            setState((s) => ({ ...s, diagnosis, isDiagnosing: false }))
            return diagnosis
        } catch (error) {
            setState((s) => ({ ...s, isDiagnosing: false, error: (error as Error).message }))
            return null
        }
    }, [address])

    /**
     * Sends the repair userOp for the current diagnosis, confirms it landed by
     * re-reading on-chain state (never trusting the bundle receipt — a
     * reverted userOp still yields a successful bundle), and rebuilds the
     * kernel client so subsequent signatures (the re-grant) bind fresh state.
     * Returns the post-repair diagnosis, or null on failure.
     */
    const repair = useCallback(async (): Promise<CardSignatureDiagnosis | null> => {
        if (!address || !state.diagnosis || state.diagnosis.state === 'healthy') return state.diagnosis
        setState((s) => ({ ...s, isRepairing: true, error: null }))
        try {
            // Re-diagnose against live state, not the mount-time snapshot: a
            // retry after a confirm-poll timeout must not re-send an
            // invalidateNonce the first op already consumed (it would revert).
            const diagnosis = await readDiagnosis(address as Address)
            if (diagnosis.state === 'healthy') {
                await rebuildClientForChain(CHAIN_ID)
                setState((s) => ({ ...s, diagnosis, isRepairing: false }))
                return diagnosis
            }
            if (
                diagnosis.state === 'nonce-bricked' &&
                diagnosis.validNonceFrom + 1 > diagnosis.currentNonce + MAX_NONCE_INCREMENT_SIZE
            ) {
                setState((s) => ({
                    ...s,
                    diagnosis,
                    isRepairing: false,
                    error: 'This wallet needs a manual repair — please contact support.',
                }))
                return null
            }
            const call =
                diagnosis.state === 'nonce-bricked'
                    ? {
                          to: address as Address,
                          value: 0n,
                          data: encodeFunctionData({
                              abi: KernelV3AccountAbi,
                              functionName: 'invalidateNonce',
                              args: [diagnosis.validNonceFrom + 1],
                          }),
                      }
                    : buildMigrationNoopCall(address as Address)
            await handleSendUserOpEncoded([call], CHAIN_ID)

            let confirmed: CardSignatureDiagnosis | null = null
            for (let attempt = 0; attempt < CONFIRM_RETRIES; attempt++) {
                const fresh = await readDiagnosis(address as Address)
                if (fresh.state === 'healthy') {
                    confirmed = fresh
                    break
                }
                if (attempt < CONFIRM_RETRIES - 1) await delay(CONFIRM_INTERVAL_MS)
            }
            if (!confirmed) {
                setState((s) => ({
                    ...s,
                    isRepairing: false,
                    error: 'The repair did not confirm on-chain in time — please retry in a moment',
                }))
                return null
            }
            // The repair op may have run the root-validator migration; rebuild so
            // the re-grant signs via the current validator, not a stale wrapper.
            await rebuildClientForChain(CHAIN_ID)
            setState((s) => ({ ...s, diagnosis: confirmed, isRepairing: false }))
            return confirmed
        } catch (error) {
            const message = (error as Error).message ?? String(error)
            // A dismissed passkey sheet is not a failure — clear busy quietly,
            // matching how the grant path treats user-cancelled.
            setState((s) => ({ ...s, isRepairing: false, error: isUserCancelled(message) ? null : message }))
            return null
        }
    }, [address, state.diagnosis, handleSendUserOpEncoded, rebuildClientForChain])

    return {
        diagnosis: state.diagnosis,
        isDiagnosing: state.isDiagnosing,
        isRepairing: state.isRepairing,
        error: state.error,
        diagnose,
        repair,
    }
}
