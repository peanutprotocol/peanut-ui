import { useContext } from 'react'

import * as assets from '@/assets'
import * as context from '@/context'
import * as consts from '@/constants'
import * as _consts from '../Create.consts'
import Icon from '@/components/Global/Icon'
import ConfirmDetails from '@/components/Global/ConfirmDetails/Index'
export const CreateLinkConfirmView = ({ onNext, onPrev }: _consts.ICreateScreenProps) => {
    const { selectedChainID, selectedTokenAddress } = useContext(context.tokenSelectorContext) // TODO: change name tokenSelectorContext

    return (
        <div className="flex w-full flex-col items-center justify-center gap-6 text-center">
            <label className="text-h2">Send crypto with a link</label>
            <label className="max-w-96 text-start text-h8 font-light">
                Choose the chain, set the amount, confirm the transaction. You’ll get a trustless payment link. They
                will be able to claim the funds in any token on any chain.
            </label>
            <ConfirmDetails
                selectedChainID={selectedChainID}
                selectedTokenAddress={selectedTokenAddress}
                tokenAmount={'0.1'}
                title="You're sending"
            />

            <div className="flex w-full max-w-96 flex-row items-center justify-between ">
                <label className="text-sm font-bold text-gray-1">Network cost</label>
                <div className="flex flex-row items-center justify-center gap-1">
                    <Icon name={'gas'} className="h-4 fill-white" />
                    {/* <img src={assets.GAS_ICON.src} className="h-4 w-4 fill-white" /> */}
                    <label className="text-sm leading-4">$0.68</label>
                </div>
            </div>

            <div className="flex w-full flex-col items-center justify-center gap-2">
                <button className="btn-purple btn-xl" onClick={() => onNext('normal')}>
                    Confirm Send
                </button>
                <button className="btn btn-xl" onClick={() => onPrev('normal')}>
                    Return
                </button>
            </div>
        </div>
    )
}
