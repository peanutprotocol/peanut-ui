'use client'
import { useContext, useState } from 'react'
import * as context from '@/context'
import * as _consts from '../Cashout.consts'
import Loading from '@/components/Global/Loading'
import ConfirmCashoutDetails from './ConfirmCashoutDetails'

export const ConfirmCashoutView = ({ onNext, onPrev, recipient, usdValue }: _consts.ICashoutScreenProps) => {
    const [errorState, setErrorState] = useState<{
        showError: boolean
        errorMessage: string
    }>({ showError: false, errorMessage: '' })
    const { setLoadingState, loadingState, isLoading } = useContext(context.loadingStateContext)

    const handleConfirm = async () => {
        setLoadingState('Loading')
        setErrorState({
            showError: false,
            errorMessage: '',
        })
        onNext()
    }

    return (
        <div className="mx-auto flex w-full max-w-[96%] flex-col justify-center gap-6 text-center">
            <label className="text-h4">Confirm your details</label>
            <div className="flex flex-col  justify-center gap-3">
                <label className="max-w-96 text-left text-h8 font-light">
                    Cashing out usually takes 20 minutes but can take up to two days. You will receive an email
                    confirmation.
                </label>
                <label className="max-w-96 text-left text-h9 font-light">
                    Fees: $0.50. Requires KYC. Only US & Europe
                </label>
            </div>
            <label className="max-w-96 text-start text-h8 font-light">Please confirm all details</label>
            <div className="flex w-full flex-col items-center justify-start gap-2 border border-black p-4">
                <ConfirmCashoutDetails tokenAmount={usdValue as string} />
                <label className="max-w-96 text-center text-h6 font-light">Konrad Urban</label>
                <label className="max-w-96 text-center text-h6 font-light">konrad@peanut.to</label>
                <label className="max-w-96 text-center text-h6 font-light">{recipient.address}</label>
            </div>
            <div className="flex flex-col justify-center gap-1">
                <label className="max-w-96 text-left text-h8 font-light">Route: Offramp -&gt; IBAN</label>
                <label className="max-w-96 text-left text-h8 font-light">Fee: $0.5</label>
                <label className="max-w-96 text-left text-h8 font-light">
                    Total received: ${Number(usdValue) - 0.5}
                </label>
            </div>

            <div className="flex w-full flex-col items-center justify-center gap-2">
                <button className="btn-purple btn-xl w-full max-w-[100%]" onClick={handleConfirm} disabled={isLoading}>
                    {isLoading ? (
                        <div className="flex w-full flex-row items-center justify-center gap-2">
                            <Loading /> {loadingState}
                        </div>
                    ) : (
                        'Submit'
                    )}
                </button>
                <button className="btn btn-xl w-full max-w-[100%]" onClick={onPrev} disabled={isLoading}>
                    Return
                </button>
                {errorState.showError && (
                    <div className="text-center">
                        <label className=" text-h8 font-normal text-red ">{errorState.errorMessage}</label>
                    </div>
                )}
            </div>
        </div>
    )
}
