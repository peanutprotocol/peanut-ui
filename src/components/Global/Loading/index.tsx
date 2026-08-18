import { PEANUTMAN } from '@/assets/mascot'
import Image from 'next/image'
import { twMerge } from 'tailwind-merge'

/** 'spinner' = inline border spinner (buttons, rows). 'mascot' = screen-level
 *  spinning peanutman (the old PeanutLoading, folded in by DS 06). the union is
 *  discriminated so mascot-only props don't silently no-op on the spinner. */
type LoadingProps =
    | {
          variant?: 'spinner'
          className?: string
          coverFullScreen?: never
          message?: never
      }
    | {
          variant: 'mascot'
          className?: never
          /** overlay the whole screen */
          coverFullScreen?: boolean
          /** caption under the mascot */
          message?: string
      }

const Loading = ({ className, variant = 'spinner', coverFullScreen = false, message }: LoadingProps) => {
    if (variant === 'mascot') {
        return (
            <div role="status" className="w-full flex-col items-center justify-center self-center text-center">
                <div
                    className={twMerge(
                        'flex w-full flex-col items-center justify-center self-center',
                        coverFullScreen &&
                            'fixed top-0 left-0 z-50 flex h-screen w-full items-center justify-center bg-background'
                    )}
                >
                    <div className="animate-spin">
                        <Image src={PEANUTMAN} alt="Peanut mascot" className="h-10 w-auto" />
                        {/* one accessible copy: the visible caption announces when present */}
                        {!message && <span className="sr-only">Loading...</span>}
                    </div>
                    {message && <div className="mt-6 text-center font-medium">{message}</div>}
                </div>
            </div>
        )
    }

    return (
        <div
            className={`text-surface inline-block aspect-square animate-spin rounded-full border-2 border-solid border-current border-e-transparent align-middle ${className ?? 'h-4 w-4'}`}
            role="status"
        >
            <span className="sr-only">Loading...</span>
        </div>
    )
}

export default Loading
