import QRCodeWrapper from '@/components/Global/QRCodeWrapper'
import * as _consts from '../Create.consts'
import CopyField from '@/components/Global/CopyField'
import Link from 'next/link'
import Icon from '@/components/Global/Icon'

export const SuccessView = ({ onNext, onPrev }: _consts.ICreateScreenProps) => {
    return (
        <div className={`flex w-full flex-col items-center justify-center gap-6 py-2 pb-20 text-center`}>
            <label className="text-h2">Request a payment</label>
            <label className="w-full max-w-96 text-h8 font-light">
                You are requesting 12 ETH from on Arbitrum to 0x04B5f21facD2ef7c7dbdEe7EbCFBC68616adC45C
            </label>

            <QRCodeWrapper url={''} />
            <label className="text-h8 ">
                Share this link or QR code with the recipient. They will be able to claim the funds on any chain in any
                token.
            </label>

            <CopyField text={'https://peanut.to/claim?c=8453&v=v4.3&i=8344&t=ui#p=DmY2oT1G2jufHruA'} />

            <Link className="cursor-pointer text-h8 font-bold text-gray-1 underline" target="_blank" href={``}>
                Transaction hash
            </Link>

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
