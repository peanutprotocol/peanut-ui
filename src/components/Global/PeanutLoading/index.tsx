import { PEANUTMAN_LOGO } from '@/assets'

export default function PeanutLoading() {
    return (
        <div className="relative flex w-full items-center justify-center self-center">
            <div className="animate-spin">
                <img src={PEANUTMAN_LOGO.src} alt="logo" className="h-6 sm:h-10" />
                <span className="sr-only">Loading...</span>
            </div>
        </div>
    )
}
