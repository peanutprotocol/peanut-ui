/** UI-friendly error message extractor. Pre-decomplexify this matched
 *  on the Peanut SDK's `SDKStatus` enum codes; with the SDK gone, the
 *  function falls back to substring matching on common wallet / viem /
 *  Peanut API error messages. */
export const ErrorHandler = (error: any): string => {
    const text = error?.toString?.() ?? ''
    if (text.includes('insufficient funds')) return "You don't have enough funds."
    if (text.includes('user rejected transaction')) return 'Please confirm the transaction in your wallet.'
    if (text.includes('not deployed on chain')) return 'Bulk is not able on this chain, please try another chain.'
    if (text.includes('User rejected the request')) return 'Please confirm the request in your wallet.'
    if (text.includes('NETWORK_ERROR')) return 'A network error occured. Please refresh and try again.'
    if (text.includes('NONCE_EXPIRED')) return 'Nonce expired, please try again.'
    if (text.includes('Failed to get wallet client')) return 'Please make sure your wallet is connected.'
    if (text.includes('gas required exceeds allowance'))
        return 'Gas required exceeds balance. Please confirm you have enough funds.'
    if (
        text.includes('fee cap (`maxFeePerGas`)') ||
        text.includes('max fee per gas less than block base fee') ||
        text.includes('EstimateGasExecutionError')
    ) {
        return 'Transaction failed, please make sure you have enough native token on this network to cover gas fees.'
    }
    if (
        text.includes(
            'Something went wrong while fetching the token price. Please change the input denomination and try again'
        )
    )
        return 'Something went wrong while fetching the token price. Please change the input denomination and try again.'
    if (text.includes('Please ensure that the correct token and chain are defined'))
        return 'Please ensure that the correct token and chain are defined.'
    if (text.includes('Please ensure that you have sufficient balance of the token you are trying to send'))
        return 'Please ensure that you have sufficient balance of the token you are trying to send, including gas fees.'
    if (text.includes('The minimum amount to send is 0.0001')) return 'The minimum amount to send is 0.0001.'
    if (text.includes('Error getting the linkDetails')) return 'Error getting the linkDetails.'
    if (text.includes('Error generating the password.')) return 'Error generating the password.'
    if (text.includes('Error making the gasless deposit payload.')) return 'Error making the gasless deposit payload.'
    if (text.includes('Error preparing the transaction(s).')) return 'Error preparing the transaction(s).'
    if (text.includes('Error switching network.')) return 'Error switching network.'
    if (text.includes('Error signing the data in the wallet.')) return 'Error signing the data in the wallet.'
    if (text.includes('Error making the gasless deposit through the peanut api.'))
        return 'Error making the gasless deposit through the peanut api.'
    if (text.includes('Error sending the transaction.')) return 'Error sending the transaction.'
    if (text.includes('Error getting the link with transactionHash')) return error.message
    if (text.includes('transfer amount exceeds balance'))
        return 'You do not have enough balance to complete the transaction.'
    if (text.includes('does not match the target chain for the transaction'))
        return 'Failed to switch network. Try switching to the correct network manually.'
    if (text.includes('Insufficient balance')) return "You don't have enough balance."
    if (text.includes('The operation either timed out or was not allowed')) return 'Please confirm the transaction.'
    if (text.includes('Wrong password or invalid transaction.') || text.includes('transaction may fail'))
        return 'Could not claim link, please refresh page. If problem persist confirm link with sender'
    if (text.includes('Send link already claimed')) return 'Send link already claimed'
    if (text.toLowerCase().includes('liquidity'))
        return error.message || 'Low liquidity. Please try a smaller amount or different route.'
    return 'There was an issue with your request. Please contact support.'
}
