import { PEANUTMAN_LOGO } from '@/assets'
import { twMerge } from 'tailwind-merge'

export default function PeanutLoading({ coverFullScreen = false }: { coverFullScreen?: boolean }) {
    return (
        <div
            className={twMerge(
                'relative flex w-full items-center justify-center self-center',
                coverFullScreen &&
                    'fixed left-0 top-0 z-50 flex h-screen w-full items-center justify-center bg-background'
            )}
        >
            <div className={twMerge('animate-spin')}>
                <img src={PEANUTMAN_LOGO.src} alt="logo" className="h-6 sm:h-10" />
                <span className="sr-only">Loading...</span>
            </div>
        </div>
    )
}
