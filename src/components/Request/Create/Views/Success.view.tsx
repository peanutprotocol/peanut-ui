import QRCodeWrapper from '@/components/Global/QRCodeWrapper'
import * as _consts from '../Create.consts'
import CopyField from '@/components/Global/CopyField'
import Link from 'next/link'
import Icon from '@/components/Global/Icon'

export const SuccessView = ({ link }: _consts.ICreateScreenProps) => {
    return (
        <div className={`flex w-full flex-col items-center justify-center gap-6 py-2 pb-20 text-center`}>
            <label className="text-h2">Yay!</label>

            <QRCodeWrapper url={link} />
            <label className="text-h8 ">
                Share this link or QR with anyone. They will be able to pay you from any chain in any token.
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
