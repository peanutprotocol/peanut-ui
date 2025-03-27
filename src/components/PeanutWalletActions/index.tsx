import Link from 'next/link'
import { ArrowIcon, Button } from '../0_Bruddle'
import AddFunds from '../AddFunds'

const PeanutWalletActions = () => {
    return (
        <div className="flex items-center justify-center gap-4">
            <AddFunds />
            <Link href={'/request/create'} className="flex flex-col items-center gap-2.5">
                <Button variant={'purple'} className={'h-10 w-10 cursor-pointer rounded-full p-0'} shadowSize="4">
                    <ArrowIcon size={20} className="rotate-180" />
                </Button>
                <div className="font-semibold">Request</div>
            </Link>
            <Link href={'/send'} className="flex flex-col items-center gap-2.5">
                <Button variant={'purple'} className={'h-10 w-10 cursor-pointer rounded-full p-0'} shadowSize="4">
                    <ArrowIcon size={20} />
                </Button>
                <div className="font-semibold">Send</div>
            </Link>
        </div>
    )
}

export default PeanutWalletActions
