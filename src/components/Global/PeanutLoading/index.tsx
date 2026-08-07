import { PEANUTMAN } from '@/assets/mascot'
import Image from 'next/image'
import { twMerge } from 'tailwind-merge'

export default function PeanutLoading({
    coverFullScreen = false,
    message,
}: {
    coverFullScreen?: boolean
    message?: string
}) {
    return (
        <div className="w-full flex-col items-center justify-center self-center text-center">
            <div
                className={twMerge(
                    'flex w-full items-center justify-center self-center',
                    coverFullScreen &&
                        'fixed left-0 top-0 z-50 flex h-screen w-full items-center justify-center bg-background'
                )}
            >
                <div className={twMerge('animate-spin')}>
                    <Image src={PEANUTMAN} alt="Peanut mascot" className="h-10 w-auto" />
                    <span className="sr-only">{message ?? 'Loading...'}</span>
                </div>
            </div>
            <div className="mt-6 self-center text-center text-center font-medium">{message}</div>
        </div>
    )
}
