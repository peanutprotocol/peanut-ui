import peanut from '@squirrel-labs/peanut-sdk'

export declare class SDKStatus extends Error {
    code: any
    extraInfo?: any
    constructor(code: any, message?: string, extraInfo?: string)
}

export const ErrorHandler = (error: any) => {
    if (error instanceof peanut.interfaces.SDKStatus && !error.originalError) {
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
    } else {
        throw error
        console.log(error.toString())
        if (error.toString().includes('insufficient funds')) {
            return "You don't have enough funds."
        } else if (error.toString().includes('user rejected transaction')) {
            return 'Please confirm the transaction in your wallet.'
        } else if (error.toString().includes('not deployed on chain')) {
            return 'Bulk is not able on this chain, please try another chain.'
        } else if (error.toString().includes('User rejected the request')) {
            return 'Please confirm the request in your wallet.'
        } else if (error.toString().includes('NETWORK_ERROR')) {
            return 'A network error occured. Please refresh and try again.'
        } else if (error.toString().includes('NONCE_EXPIRED')) {
            return 'Nonce expired, please try again.'
        } else if (error.toString().includes('Failed to get wallet client')) {
            return 'Please make sure your wallet is connected.'
        } else if (error.toString().includes('gas required exceeds allowance')) {
            return 'Gas required exceeds balance. Please confirm you have enough funds.'
        } else if (
            error
                .toString()
                .includes(
                    'Something went wrong while fetching the token price. Please change the input denomination and try again'
                )
        ) {
            return 'Something went wrong while fetching the token price. Please change the input denomination and try again.'
        } else if (error.toString().includes('Please ensure that the correct token and chain are defined')) {
            return 'Please ensure that the correct token and chain are defined.'
        } else if (
            error
                .toString()
                .includes('Please ensure that you have sufficient balance of the token you are trying to send')
        ) {
            return 'Please ensure that you have sufficient balance of requested token.'
        } else if (error.toString().includes('The minimum amount to send is 0.0001')) {
            return 'The minimum amount to send is 0.0001.'
        } else if (error.toString().includes('Error getting the linkDetails')) {
            return 'Error getting the linkDetails.'
        } else if (error.toString().includes('Error generating the password.')) {
            return 'Error generating the password.'
        } else if (error.toString().includes('Error making the gasless deposit payload.')) {
            return 'Error making the gasless deposit payload.'
        } else if (error.toString().includes('Error preparing the transaction(s).')) {
            return 'Error preparing the transaction(s).'
        } else if (error.toString().includes('Error switching network.')) {
            return 'Error switching network.'
        } else if (error.toString().includes('Error signing the data in the wallet.')) {
            return 'Error signing the data in the wallet.'
        } else if (error.toString().includes('Error making the gasless deposit through the peanut api.')) {
            return 'Error making the gasless deposit through the peanut api.'
        } else if (error.toString().includes('Error sending the transaction.')) {
            return 'Error sending the transaction.'
        } else if (error.toString().includes('Error getting the link with transactionHash')) {
            return error.message
        } else {
            return 'Something failed. Please try again.'
        }
    }
}
