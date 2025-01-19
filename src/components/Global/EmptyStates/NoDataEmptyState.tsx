import { PEANUTMAN_CRY } from '@/assets'
import Image from 'next/image'

const NoDataEmptyState = ({ message }: { message: string }) => {
    return (
        <div className="flex flex-col items-center justify-center gap-3">
            <Image src={PEANUTMAN_CRY} alt="Peanutman crying 😭" className="size-20 md:size-24" />
            <div>{message}</div>
        </div>
    )
}

export default NoDataEmptyState
