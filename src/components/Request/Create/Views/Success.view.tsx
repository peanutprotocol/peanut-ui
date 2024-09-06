import QRCodeWrapper from '@/components/Global/QRCodeWrapper'
import * as _consts from '../Create.consts'
import CopyField from '@/components/Global/CopyField'
import Link from 'next/link'
import Icon from '@/components/Global/Icon'
import * as context from '@/context'
import * as consts from '@/constants'
import * as utils from '@/utils'
import { useContext } from 'react'

export const SuccessView = ({ onNext, onPrev, tokenValue, recipientAddress, link }: _consts.ICreateScreenProps) => {
    const { selectedTokenPrice, inputDenomination, selectedChainID, selectedTokenAddress } = useContext(
        context.tokenSelectorContext
    )
    return (
        <div className={`flex w-full flex-col items-center justify-center gap-6 py-2 pb-20 text-center`}>
            <label className="text-h2">Request a payment</label>
            <label className="w-full max-w-96 text-h8 font-light">
                You are requesting {utils.formatTokenAmount(parseFloat(tokenValue ?? ''), 4)}{' '}
                {
                    consts.peanutTokenDetails
                        .find((chain) => chain.chainId === selectedChainID)
                        ?.tokens.find((token) => token.address === selectedTokenAddress)?.symbol
                }{' '}
                on {consts.supportedPeanutChains.find((chain) => chain.chainId === selectedChainID)?.name} to{' '}
                {recipientAddress}
            </label>

            <QRCodeWrapper url={link} />
            <label className="text-h8 ">
                Share this link or QR code with the recipient. They will be able to claim the funds on any chain in any
                token.
            </label>

            <CopyField text={link} />

            <Link
                className="absolute bottom-0 flex h-20 w-[27rem] w-full flex-row items-center justify-start gap-2 border-t-[1px] border-black bg-purple-3  px-4.5 dark:text-black"
                href={'/profile'}
            >
                <div className=" border border-n-1 p-0 px-1">
                    <Icon name="profile" className="-mt-0.5" />
                </div>
                See your payments.
            </Link>
        </div>
    )
}
