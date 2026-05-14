/**
 * Rain V2 contract constants — shared ABIs + EIP-712 metadata for the
 * admin withdrawal signature. Both `useSpendBundle` and the dev withdraw
 * page consume these.
 */

export const rainCoordinatorAbi = [
    {
        inputs: [
            { name: '_collateralProxy', type: 'address' },
            { name: '_asset', type: 'address' },
            { name: '_amountNative', type: 'uint256' },
            { name: '_recipient', type: 'address' },
            { name: '_expiresAt', type: 'uint256' },
            { name: '_executorPublisherSalt', type: 'bytes32' },
            { name: '_executorPublisherSignature', type: 'bytes' },
            { name: '_adminSalts', type: 'bytes32[]' },
            { name: '_adminSignatures', type: 'bytes[]' },
            { name: '_directTransfer', type: 'bool' },
        ],
        name: 'withdrawAsset',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
    },
] as const

export const rainCollateralAbi = [
    {
        inputs: [],
        name: 'adminNonce',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
] as const

/**
 * EIP-712 parameters for the admin `Withdraw` signature. Verified on-chain
 * by Rain's coordinator via `SignatureChecker.isValidSignatureNow` against
 * the admin (the user's kernel smart account).
 */
export const RAIN_WITHDRAW_EIP712_DOMAIN_NAME = 'Collateral'
export const RAIN_WITHDRAW_EIP712_DOMAIN_VERSION = '2'

export const rainWithdrawEip712Types = {
    Withdraw: [
        { name: 'user', type: 'address' },
        { name: 'asset', type: 'address' },
        { name: 'amount', type: 'uint256' },
        { name: 'recipient', type: 'address' },
        { name: 'nonce', type: 'uint256' },
    ],
} as const
