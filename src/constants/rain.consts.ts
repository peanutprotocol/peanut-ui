/**
 * Rain V2 contract constants — shared ABIs + EIP-712 metadata for the
 * admin withdrawal signature. Both `useSpendBundle` and the dev withdraw
 * page consume these.
 */

/**
 * The statement the user authorizes for managed card funding, word for word.
 * The backend records it byte for byte and refuses any other text, so the UI
 * shows exactly this and never a translation of it.
 */
export const RTF_AUTHORIZATION_TEXT = 'I authorize transfers according to the Real-Time Funding Terms.'
/** The part of the statement that links to the terms. */
export const RTF_TERMS_LABEL = 'Real-Time Funding Terms'
/**
 * The only funding permission scope this app knows how to sign: scope 2 is
 * exactly two policies, in this order — the approve-only call policy, then a
 * signature-caller policy with no allowed callers that denies every ERC-1271
 * signature. Scope 1 (call policy alone) left the session key able to sign for
 * the wallet.
 */
export const RTF_SUPPORTED_SCOPE_VERSION = 2
/** Reason the backend gives when this permission was retired on chain and cannot be signed again. */
export const RTF_SCOPE_RETIRED_REASON = 'scope_retired'
/**
 * Reason the backend gives (with `temporarily_unavailable` and no migration)
 * while a card withdrawal it submitted is still confirming: the old permission
 * cannot be retired until it settles. Setup is unfinished, not done.
 */
export const RTF_WITHDRAWAL_IN_FLIGHT_REASON = 'withdrawal_in_flight'

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
