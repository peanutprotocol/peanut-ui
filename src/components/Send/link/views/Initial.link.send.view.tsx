'use client'

import { useCreateLink } from '@/components/Create/useCreateLink'
import PeanutActionCard from '@/components/Global/PeanutActionCard'
import PeanutSponsored from '@/components/Global/PeanutSponsored'
import { PEANUT_WALLET_TOKEN_DECIMALS } from '@/constants'
import { loadingStateContext } from '@/context'
import { useWallet } from '@/hooks/wallet/useWallet'
import { useAppDispatch, useSendFlowStore } from '@/redux/hooks'
import { sendFlowActions } from '@/redux/slices/send-flow-slice'
import { walletActions } from '@/redux/slices/wallet-slice'
import { balanceByToken, ErrorHandler, floorFixed, printableUsdc } from '@/utils'
import { captureException } from '@sentry/nextjs'
import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { Button } from '../../../0_Bruddle'
import FileUploadInput from '../../../Global/FileUploadInput'
import MoreInfo from '../../../Global/MoreInfo'
import TokenAmountInput from '../../../Global/TokenAmountInput'
import { parseUnits, encodeFunctionData, parseAbi, parseEventLogs, bytesToNumber, toBytes } from 'viem'
import type { Hash } from 'viem'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN } from '@/constants'
import {
    getLatestContractVersion,
    getContractAbi,
    getContractAddress,
    generateKeysFromString,
    getLinkFromParams,
} from '@squirrel-labs/peanut-sdk'
import { useZeroDev } from '@/hooks/useZeroDev'
import { sendLinksApi } from '@/services/sendLinks'

const LinkSendInitialView = () => {
    const dispatch = useAppDispatch()
    const { attachmentOptions, errorState } = useSendFlowStore()

    const { generateLinkDetails, generatePassword } = useCreateLink()

    const { handleSendUserOpEncoded } = useZeroDev()

    const { setLoadingState, loadingState, isLoading } = useContext(loadingStateContext)

    const [currentInputValue, setCurrentInputValue] = useState<string | undefined>('')
    const { selectedWallet, address, refetchBalances, peanutWalletDetails } = useWallet()

    const peanutWalletBalance = useMemo(() => {
        if (!peanutWalletDetails?.balance) return undefined
        return printableUsdc(peanutWalletDetails.balance)
    }, [peanutWalletDetails?.balance])

    const maxValue = useMemo(() => {
        if (!selectedWallet?.balances) {
            return selectedWallet?.balance ? printableUsdc(selectedWallet.balance) : ''
        }
        const balance = balanceByToken(selectedWallet.balances, PEANUT_WALLET_CHAIN.id.toString(), PEANUT_WALLET_TOKEN)
        if (!balance) return ''
        return floorFixed(balance.amount, PEANUT_WALLET_TOKEN_DECIMALS)
    }, [selectedWallet?.balances, selectedWallet?.balance])

    const handleOnNext = useCallback(async () => {
        try {
            if (isLoading || !currentInputValue) return

            setLoadingState('Loading')

            // clear any previous errors
            dispatch(
                sendFlowActions.setErrorState({
                    showError: false,
                    errorMessage: '',
                })
            )

            setLoadingState('Generating details')
            const password = await generatePassword()
            const generatedKeys = generateKeysFromString(password)

            const amount = parseUnits(currentInputValue!, PEANUT_WALLET_TOKEN_DECIMALS)
            const chainId = PEANUT_WALLET_CHAIN.id.toString()
            const contractVersion = getLatestContractVersion({
                chainId,
                type: 'normal',
            })
            const contractAbi = getContractAbi(contractVersion)
            const contractAddress: Hash = getContractAddress(chainId, contractVersion) as Hash

            const approveData = encodeFunctionData({
                abi: parseAbi(['function approve(address _spender, uint256 _amount) external returns (bool)']),
                functionName: 'approve',
                args: [contractAddress, amount],
            })
            const makeDepositData = encodeFunctionData({
                abi: contractAbi,
                functionName: 'makeDeposit',
                args: [PEANUT_WALLET_TOKEN as Hash, 1, amount, 0, generatedKeys.address as Hash],
            })
            const receipt = await handleSendUserOpEncoded(
                [
                    { to: PEANUT_WALLET_TOKEN as Hash, value: 0n, data: approveData },
                    { to: contractAddress, value: 0n, data: makeDepositData },
                ],
                chainId
            )
            const depositEvent = parseEventLogs({
                abi: contractAbi,
                eventName: 'DepositEvent',
                logs: receipt.logs,
            })[0]
            const depositIdx = bytesToNumber(toBytes(depositEvent.topics[1]!))

            const link = getLinkFromParams(
                chainId,
                contractVersion,
                depositIdx,
                password,
                `${process.env.NEXT_PUBLIC_BASE_URL!}/claim`,
                undefined
            )

            dispatch(sendFlowActions.setLink(link))
            dispatch(sendFlowActions.setView('SUCCESS'))
            refetchBalances(address!)

            // We dont need to wait for this to finish in order to proceed
            setTimeout(async () => {
                try {
                    await sendLinksApi.create({
                        pubKey: generatedKeys.address,
                        chainId,
                        txHash: receipt.transactionHash,
                        contractVersion,
                        depositIdx,
                        reference: attachmentOptions?.message,
                        attachment: attachmentOptions?.rawFile,
                        filename: attachmentOptions?.rawFile?.name,
                        mimetype: attachmentOptions?.rawFile?.type,
                    })
                } catch (error) {
                    // We want to capture any errors here because we are already in the background
                    console.error(error)
                    captureException(error)
                }
            }, 0)
        } catch (error) {
            // handle errors
            const errorString = ErrorHandler(error)
            dispatch(
                sendFlowActions.setErrorState({
                    showError: true,
                    errorMessage: errorString,
                })
            )
            captureException(error)
        } finally {
            setLoadingState('Idle')
        }
    }, [isLoading, currentInputValue, generateLinkDetails, handleSendUserOpEncoded, address])

    useEffect(() => {
        if (!!peanutWalletDetails) dispatch(walletActions.setSelectedWalletId(peanutWalletDetails.id))
    }, [peanutWalletDetails])

    useEffect(() => {
        if (!peanutWalletBalance || !currentInputValue) return
        if (
            parseUnits(peanutWalletBalance, PEANUT_WALLET_TOKEN_DECIMALS) <
            parseUnits(currentInputValue, PEANUT_WALLET_TOKEN_DECIMALS)
        ) {
            dispatch(
                sendFlowActions.setErrorState({
                    showError: true,
                    errorMessage: 'Insufficient balance',
                })
            )
        } else {
            dispatch(
                sendFlowActions.setErrorState({
                    showError: false,
                    errorMessage: '',
                })
            )
        }
    }, [peanutWalletBalance, currentInputValue])

    return (
        <div className="w-full space-y-4">
            <PeanutActionCard type="send" />

            <TokenAmountInput
                className="w-full"
                tokenValue={currentInputValue}
                maxValue={maxValue}
                setTokenValue={setCurrentInputValue}
                onSubmit={handleOnNext}
                walletBalance={peanutWalletBalance}
            />

            <FileUploadInput
                attachmentOptions={attachmentOptions}
                setAttachmentOptions={sendFlowActions.setAttachmentOptions}
            />

            <PeanutSponsored />

            <div className="flex flex-col gap-4">
                <Button
                    onClick={handleOnNext}
                    loading={isLoading}
                    disabled={isLoading || !currentInputValue || !!errorState?.showError}
                >
                    {isLoading ? loadingState : 'Create link'}
                </Button>
                {errorState?.showError && (
                    <div className="text-start">
                        <label className=" text-h8 font-normal text-red ">{errorState.errorMessage}</label>
                    </div>
                )}
            </div>

            <span className="flex flex-row items-center justify-start gap-1 text-h8">
                Learn about Peanut cashout
                <MoreInfo
                    text={
                        <>
                            You can use Peanut to cash out your funds directly to your bank account! (US and EU only)
                            <br></br>{' '}
                            <a href="/cashout" className="hover:text-primary underline">
                                Learn more →
                            </a>
                        </>
                    }
                />
            </span>
        </div>
    )
}

export default LinkSendInitialView
