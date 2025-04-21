import { LoadingStates } from '@/constants/loadingStates.consts'
import { sendFlowActions } from '@/redux/slices/send-flow-slice'
import { IAttachmentOptions } from '@/redux/types/send-flow.types'
import { saveCreatedLinkToLocalStorage, updateUserPreferences, getLinkFromReceipt } from '@/utils'
import { interfaces as peanutInterfaces } from '@squirrel-labs/peanut-sdk'
import { Dispatch } from 'redux'
import type { TransactionReceipt } from 'viem'

interface CreateAndProcessLinkParams {
    transactionType: 'gasless' | 'not-gasless'
    preparedDepositTxs?: peanutInterfaces.IPrepareDepositTxsResponse
    gaslessPayload?: peanutInterfaces.IGaslessDepositPayload
    gaslessPayloadMessage?: peanutInterfaces.IPreparedEIP712Message
    linkDetails?: peanutInterfaces.IPeanutLinkDetails
    password?: string
    attachmentOptions: IAttachmentOptions
    address?: string
    selectedChainID: string
    usdValue?: string
    selectedTokenPrice?: number
    estimatedPoints?: number
    selectedTokenAddress: string
    selectedTokenDecimals?: number
    feeOptions?: any
    sendTransactions: (params: {
        preparedDepositTxs: peanutInterfaces.IPrepareDepositTxsResponse
        feeOptions?: any
    }) => Promise<TransactionReceipt[]>
    signTypedData: (params: { gaslessMessage: peanutInterfaces.IPreparedEIP712Message }) => Promise<string>
    makeDepositGasless: (params: {
        signature: string
        payload: peanutInterfaces.IGaslessDepositPayload
    }) => Promise<string>
    getLinkFromHash: (params: {
        hash: string
        linkDetails: peanutInterfaces.IPeanutLinkDetails
        password: string
        walletType?: string
    }) => Promise<string>
    submitClaimLinkInit: (params: {
        password: string
        attachmentOptions: {
            attachmentFile?: File
            message?: string
        }
        senderAddress: string
    }) => Promise<{ fileUrl?: string }>
    submitClaimLinkConfirm: (params: {
        chainId: string
        link: string
        password: string
        txHash: string
        senderAddress: string
        amountUsd: number
        transaction?: any
    }) => Promise<void>
    walletType?: 'blockscout' | undefined
    refetchBalances: (address: string) => void
    dispatch: Dispatch
    setLoadingState: (state: LoadingStates) => void
}

// shared utility function that handles the entire link creation process
// used by both initial and confirm send views for consistency
export const createAndProcessLink = async ({
    transactionType,
    preparedDepositTxs,
    gaslessPayload,
    gaslessPayloadMessage,
    linkDetails,
    password,
    attachmentOptions,
    address,
    selectedChainID,
    usdValue,
    selectedTokenPrice,
    estimatedPoints,
    selectedTokenAddress,
    selectedTokenDecimals,
    feeOptions,
    sendTransactions,
    signTypedData,
    makeDepositGasless,
    getLinkFromHash,
    submitClaimLinkInit,
    submitClaimLinkConfirm,
    walletType,
    refetchBalances,
    dispatch,
    setLoadingState,
}: CreateAndProcessLinkParams): Promise<boolean> => {
    // track performance with timestamps
    const now = new Date().getTime()
    console.log(`Starting at ${now}ms`)
    setLoadingState('Loading')

    try {
        let hash = ''
        let fileUrl = ''
        let receipt: TransactionReceipt | undefined

        // step 1: initialize the claim link and upload any attachments
        console.log(`Submitting claim link init at ${new Date().getTime() - now}ms`)
        const data = await submitClaimLinkInit({
            password: password ?? '',
            attachmentOptions: {
                attachmentFile: attachmentOptions.rawFile,
                message: attachmentOptions.message,
            },
            senderAddress: address ?? '',
        })
        console.log(`Claim link init response at ${new Date().getTime() - now}ms`)
        fileUrl = data?.fileUrl ?? ''

        // step 2: handle the transaction based on type (gasless or not)
        if (transactionType === 'not-gasless') {
            // standard transaction flow
            if (!preparedDepositTxs) return false
            console.log(`Sending not-gasless transaction at ${new Date().getTime() - now}ms`)
            receipt = (await sendTransactions({ preparedDepositTxs: preparedDepositTxs, feeOptions: feeOptions }))[0]
            hash = receipt.transactionHash
            console.log(`Not-gasless transaction response at ${new Date().getTime() - now}ms`)
        } else {
            // gasless transaction flow
            if (!gaslessPayload || !gaslessPayloadMessage) return false
            setLoadingState('Sign in wallet')
            console.log(`Signing in wallet at ${new Date().getTime() - now}ms`)
            const signature = await signTypedData({ gaslessMessage: gaslessPayloadMessage })
            console.log(`Signing in wallet response at ${new Date().getTime() - now}ms`)
            if (!signature) return false
            setLoadingState('Executing transaction')
            console.log(`Executing transaction at ${new Date().getTime() - now}ms`)
            hash = await makeDepositGasless({ signature, payload: gaslessPayload })
            console.log(`Executing transaction response at ${new Date().getTime() - now}ms`)
        }

        dispatch(sendFlowActions.setTxHash(hash))

        // step 3: create the link from the transaction hash
        setLoadingState('Creating link')
        console.log(`Getting link from hash at ${new Date().getTime() - now}ms`)

        if (!linkDetails) {
            throw new Error('Link details not found.')
        }

        if (!password) {
            throw new Error('Password not found.')
        }

        let link: string = ''
        if (receipt) {
            link = getLinkFromReceipt({ txReceipt: receipt, linkDetails, password })
        } else {
            link = await getLinkFromHash({ hash, linkDetails, password, walletType })
        }
        console.log(`Getting link from hash response at ${new Date().getTime() - now}ms`)

        saveCreatedLinkToLocalStorage({
            address: address ?? '',
            data: {
                link,
                depositDate: new Date().toISOString(),
                USDTokenPrice: selectedTokenPrice ?? 0,
                points: estimatedPoints ?? 0,
                txHash: hash,
                message: attachmentOptions.message ?? '',
                attachmentUrl: fileUrl,
                ...linkDetails,
            },
        })

        // step 4: store link in redux and confirm the claim link
        dispatch(sendFlowActions.setLink(link))
        console.log(`Submitting claim link confirm at ${new Date().getTime() - now}ms`)
        await submitClaimLinkConfirm({
            chainId: selectedChainID,
            link,
            password: password ?? '',
            txHash: hash,
            senderAddress: address ?? '',
            amountUsd: parseFloat(usdValue ?? '0'),
            transaction:
                transactionType === 'not-gasless' ? preparedDepositTxs && preparedDepositTxs.unsignedTxs[0] : undefined,
        })
        console.log(`Submitting claim link confirm response at ${new Date().getTime() - now}ms`)

        if (selectedChainID && selectedTokenAddress && selectedTokenDecimals) {
            updateUserPreferences({
                lastUsedToken: {
                    chainId: selectedChainID,
                    address: selectedTokenAddress,
                    decimals: selectedTokenDecimals,
                },
            })
        }

        // step 5: navigate to success view and refresh balances
        console.log(`Finished at ${new Date().getTime() - now}ms`)
        dispatch(sendFlowActions.setView('SUCCESS'))
        refetchBalances(address ?? '')

        return true
    } catch (error) {
        console.error('Error creating link:', error)
        throw error
    }
}
