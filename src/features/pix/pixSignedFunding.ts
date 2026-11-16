import type { SignedSpendArtifact } from '@/hooks/wallet/useSignSpendBundle'
import type { PixWithdrawSubmitRequest } from '@/services/pix'
import { PEANUT_WALLET_CHAIN } from '@/constants/zerodev.consts'

type SignedUserOpBody = Extract<PixWithdrawSubmitRequest['funding'], { kind: 'userOp' }>['signedUserOp']

/**
 * A `transfer-then-submit` withdrawal's signed transfer, as POST /pix/withdraw/submit takes it: a
 * UserOp from the smart account (with the card collateral's preparation when the mixed strategy
 * signed it), or a card collateral withdrawal the API sends straight to the deposit address.
 */
export function pixSignedFunding(artifact: SignedSpendArtifact): PixWithdrawSubmitRequest['funding'] {
    if (artifact.strategy === 'collateral-only') {
        return {
            kind: 'rainWithdrawal',
            signedRainWithdrawal: artifact.rainWithdrawal,
            chainId: PEANUT_WALLET_CHAIN.id.toString(),
        }
    }
    return {
        kind: 'userOp',
        // a signed op names its paymaster's address, never the `true` an unsigned one may hold
        signedUserOp: artifact.signedUserOp.signedUserOp as SignedUserOpBody,
        chainId: artifact.signedUserOp.chainId,
        entryPointAddress: artifact.signedUserOp.entryPointAddress,
        ...(artifact.strategy === 'mixed' ? { rainPreparationId: artifact.rainPreparationId } : {}),
    }
}
