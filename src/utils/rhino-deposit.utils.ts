import { encodeFunctionData, erc20Abi, type Address, type Hex } from 'viem'

/** Minimal fragment of Rhino's DVFDepositContract used for cross-chain
 *  bridge / cross-chain swap deposits. Source: rhino.fi SDK
 *  (adapters/evm/abis/DVFDepositContract). */
const DVF_DEPOSIT_WITH_ID_ABI = [
    {
        type: 'function',
        name: 'depositWithId',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'tokenAddress', type: 'address' },
            { name: 'amount', type: 'uint256' },
            { name: 'commitmentId', type: 'uint256' },
        ],
        outputs: [],
    },
] as const

/**
 * Calldata for `depositWithId(tokenAddress, amount, commitmentId)` on Rhino's
 * bridge contract. Rhino's API returns no calldata for this path — the SDK
 * builds it client-side. `commitmentId` is the commit's hex id without `0x`.
 */
export function encodeRhinoDepositWithId({
    tokenAddress,
    amount,
    commitmentId,
}: {
    tokenAddress: Address
    amount: bigint
    commitmentId: string
}): Hex {
    return encodeFunctionData({
        abi: DVF_DEPOSIT_WITH_ID_ABI,
        functionName: 'depositWithId',
        args: [tokenAddress, amount, BigInt(`0x${commitmentId}`)],
    })
}

/** The two calls a committed Rhino bridge deposit needs: approve the bridge contract, then deposit. */
export function rhinoDepositWithIdCalls({
    tokenAddress,
    contractAddress,
    amount,
    commitmentId,
}: {
    tokenAddress: Address
    contractAddress: Address
    amount: bigint
    commitmentId: string
}): { to: Address; data: Hex }[] {
    return [
        {
            to: tokenAddress,
            data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [contractAddress, amount] }),
        },
        { to: contractAddress, data: encodeRhinoDepositWithId({ tokenAddress, amount, commitmentId }) },
    ]
}
