import peanut from '@squirrel-labs/peanut-sdk'

export declare class SDKStatus extends Error {
    code: any
    extraInfo?: any
    constructor(code: any, message?: string, extraInfo?: string)
}

export const sdkErrorHandler = (error: SDKStatus) => {
    switch (error.code) {
        case peanut.interfaces.ESignAndSubmitTx.ERROR_INSUFFICIENT_NATIVE_TOKEN:
            return 'Insufficient funds to complete the transaction.'
        case peanut.interfaces.ECreateLinkStatusCodes.ERROR_GETTING_LINKS_FROM_TX:
            return 'Something went wrong while getting the links from the transaction. Please try again later.'
        case peanut.interfaces.ECreateLinkStatusCodes.ERROR_SIGNING_AND_SUBMITTING_TX:
            return 'Something went wrong while signing and submitting the transaction. Please try again later.'
        case peanut.interfaces.ECreateLinkStatusCodes.ERROR_PREPARING_TX:
            return 'Something went wrong while preparing the transaction. Please try again later.'
        case peanut.interfaces.EClaimLinkStatusCodes.ERROR:
            return 'Something went wrong while claiming. Please try again later.'
        case peanut.interfaces.EGetLinkFromTxStatusCodes.ERROR_GETTING_TX_RECEIPT_FROM_HASH:
            return 'Something went wrong while getting the transaction receipt from hash. Please try again later.'
        case peanut.interfaces.EPrepareCreateTxsStatusCodes.ERROR_ESTIMATING_GAS_LIMIT:
            return 'Something went wrong while estimating gas limit. Please try again later.'
        case peanut.interfaces.EPrepareCreateTxsStatusCodes.ERROR_GETTING_TX_COUNT:
            return 'Something went wrong while getting the transaction count. Please try again later.'
        case peanut.interfaces.EPrepareCreateTxsStatusCodes.ERROR_MAKING_DEPOSIT:
            return 'Something went wrong while making the deposit. Please try again later.'
        case peanut.interfaces.EPrepareCreateTxsStatusCodes.ERROR_PREPARING_APPROVE_ERC1155_TX:
        case peanut.interfaces.EPrepareCreateTxsStatusCodes.ERROR_PREPARING_APPROVE_ERC20_TX:
        case peanut.interfaces.EPrepareCreateTxsStatusCodes.ERROR_PREPARING_APPROVE_ERC721_TX:
            return 'Something went wrong while preparing the approval transaction. Please try again later.'
        case peanut.interfaces.EPrepareCreateTxsStatusCodes.ERROR_SETTING_FEE_OPTIONS:
            return 'Something went wrong while setting the fee options. Please try again later.'
        case peanut.interfaces.EPrepareCreateTxsStatusCodes.ERROR_GETTING_DEFAULT_PROVIDER:
            return 'Something went wrong while getting the default provider. Please try again later.'
        case peanut.interfaces.EPrepareCreateTxsStatusCodes.ERROR_VALIDATING_LINK_DETAILS:
            return 'Something went wrong while validating the link details. Please try again later.'
        case peanut.interfaces.ESignAndSubmitTx.ERROR_BROADCASTING_TX:
            return 'Something went wrong while broadcasting the transaction. Please try again later.'
        default:
            return 'Something went wrong. Please try again later.'
    }
}
