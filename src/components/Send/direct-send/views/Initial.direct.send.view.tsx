'use client'

import { Button } from '@/components/0_Bruddle'
import { useCreateLink } from '@/components/Create/useCreateLink'
import ErrorAlert from '@/components/Global/ErrorAlert'
import FileUploadInput from '@/components/Global/FileUploadInput'
import { Icon } from '@/components/Global/Icons/Icon'
import TokenAmountInput from '@/components/Global/TokenAmountInput'
import UserCard from '@/components/User/UserCard'
import { ActionType, estimatePoints } from '@/components/utils/utils'
import { loadingStateContext, tokenSelectorContext } from '@/context'
import { useWallet } from '@/hooks/wallet/useWallet'
import { useAppDispatch } from '@/redux/hooks'
import { walletActions } from '@/redux/slices/wallet-slice'
import { IAttachmentOptions } from '@/redux/types/send-flow.types'
import { ApiUser, usersApi } from '@/services/users'
import { ErrorHandler, printableUsdc, saveDirectSendToLocalStorage } from '@/utils'
import { useRouter } from 'next/navigation'
import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import DirectSendSuccessView from './Success.direct.send.view'

interface DirectSendInitialViewProps {
    username: string
}

const DirectSendInitialView = ({ username }: DirectSendInitialViewProps) => {
    const router = useRouter()
    const dispatch = useAppDispatch()
    const [user, setUser] = useState<ApiUser | null>(null)
    const [currentInputValue, setCurrentInputValue] = useState<string>('')
    const [errorState, setErrorState] = useState<{ showError: boolean; errorMessage: string }>({
        showError: false,
        errorMessage: '',
    })
    const [attachmentOptions, setAttachmentOptions] = useState<IAttachmentOptions>({
        message: undefined,
        fileUrl: undefined,
        rawFile: undefined,
    })
    const [showSuccess, setShowSuccess] = useState(false)
    const [successTxHash, setSuccessTxHash] = useState('')

    const { isConnected, balance, address, sendTransactions } = useWallet()

    const peanutWalletBalance = useMemo(() => {
        return printableUsdc(balance)
    }, [balance])

    const { setLoadingState, loadingState, isLoading } = useContext(loadingStateContext)
    const { selectedChainID, selectedTokenAddress, selectedTokenDecimals } = useContext(tokenSelectorContext)

    const { prepareDirectSendTx } = useCreateLink()

    const handleTokenValueChange = (value: string | undefined) => {
        setCurrentInputValue(value || '')
    }

    const handleOnConfirm = useCallback(async () => {
        if (!isConnected) {
            dispatch(walletActions.setSignInModalVisible(true))
            return
        }

        if (!user?.username || !currentInputValue || !user.accounts?.[0]?.identifier) {
            setErrorState({
                showError: true,
                errorMessage: !currentInputValue ? 'Please enter an amount' : 'User details not loaded',
            })
            return
        }

        setLoadingState('Preparing transaction')
        try {
            const preparedTx = prepareDirectSendTx({
                tokenValue: currentInputValue,
                recipient: user.accounts[0].identifier,
                tokenAddress: selectedTokenAddress ?? '',
                tokenDecimals: selectedTokenDecimals ?? 0,
            })

            // todo: fix point estimation for direct send, probably requires change in the backend
            const estimatedPoints = await estimatePoints({
                chainId: selectedChainID ?? 0,
                address,
                amountUSD: parseFloat(currentInputValue),
                actionType: 'DIRECT_SEND' as ActionType,
            })

            setLoadingState('Preparing transaction')
            const receipt = await sendTransactions([preparedTx])

            if (receipt) {
                // save to local storage
                saveDirectSendToLocalStorage({
                    address,
                    data: {
                        chainId: selectedChainID,
                        tokenAddress: selectedTokenAddress,
                        tokenAmount: currentInputValue,
                        date: new Date().toISOString(),
                        txHash: receipt.transactionHash,
                        points: estimatedPoints ?? 0,
                    },
                })

                // todo:
                // - create backend route for direct send tx details
                // - save attachment details (message and file) to backend

                setSuccessTxHash(receipt.transactionHash)
                setShowSuccess(true)
            }
        } catch (error) {
            const errorString = ErrorHandler(error)
            setErrorState({
                showError: true,
                errorMessage: errorString,
            })
        } finally {
            setLoadingState('Idle')
        }
    }, [user, currentInputValue, isConnected, selectedTokenAddress, selectedTokenDecimals])

    useEffect(() => {
        async function fetchUser() {
            try {
                const response = await usersApi.getByUsername(username)
                setUser(response)
            } catch (error) {
                console.error(error)
                setErrorState({
                    showError: true,
                    errorMessage: 'Failed to fetch user details',
                })
            }
        }

        fetchUser()
    }, [username])

    return (
        <div className="space-y-4">
            {showSuccess ? (
                <DirectSendSuccessView
                    user={user!}
                    amount={currentInputValue}
                    message={attachmentOptions.message}
                    onBack={() => router.push('/send')}
                />
            ) : (
                <>
                    <UserCard type="send" username={user?.username || username} fullName={user?.fullName} />

                    <div className="space-y-4">
                        <TokenAmountInput
                            className="w-full"
                            tokenValue={currentInputValue}
                            maxValue={peanutWalletBalance}
                            setTokenValue={handleTokenValueChange}
                            onSubmit={handleOnConfirm}
                            walletBalance={peanutWalletBalance}
                        />

                        {/* note: this only works on client side rn, we need to fix this, potentially in history project */}
                        <FileUploadInput
                            attachmentOptions={attachmentOptions}
                            setAttachmentOptions={setAttachmentOptions}
                        />

                        {errorState.showError && <ErrorAlert description={errorState.errorMessage} />}

                        <Button
                            loading={isLoading}
                            onClick={handleOnConfirm}
                            disabled={isLoading || !currentInputValue || !isConnected}
                            shadowSize="4"
                        >
                            {!isLoading && (
                                <div className="flex size-6 items-center justify-center">
                                    <Icon name="arrow-up-right" size={20} />
                                </div>
                            )}
                            {!isConnected ? 'Connect Wallet' : isLoading ? loadingState : 'Send'}
                        </Button>
                    </div>
                </>
            )}
        </div>
    )
}

export default DirectSendInitialView
