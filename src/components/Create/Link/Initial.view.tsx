import TokenAmountInput from '@/components/Global/TokenAmountInput'
import TokenSelector from '@/components/Global/TokenSelector'
import * as _consts from '../Create.consts'

export const CreateLinkInitialView = ({ onNext }: _consts.ICreateScreenProps) => {
    return (
        <div className="flex w-full flex-col items-center justify-center gap-6 text-center">
            <label className="text-h2">Send crypto with a link</label>
            <label className="max-w-96 text-start text-h8 font-light">
                Choose the chain, set the amount, confirm the transaction. You’ll get a trustless payment link. They
                will be able to claim the funds in any token on any chain.
            </label>
            <div className="flex w-full flex-col items-center justify-center gap-3">
                <TokenAmountInput className="w-full" />
                <TokenSelector classNameButton="w-full" />
            </div>

            <button className="btn-purple btn-xl " onClick={() => onNext('normal')}>
                Connect Wallet
            </button>
        </div>
    )
}
