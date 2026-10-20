import { DropIn } from '@/components/Marketing/StarLp/DropIn'
import { PhoneFrame } from '@/components/Marketing/StarLp/PhoneFrame'
import { PopIn } from '@/components/Marketing/StarLp/PopIn'

const SCREEN = '-m-3 grid min-h-40 content-start gap-2 p-3 text-body-xs'

/**
 * Two mini phones with the same balance. On the usual app a "Funds on hold"
 * stamp drops onto it; Peanut's keeps its Send button.
 */
export function SelfCustodyAppPair() {
    return (
        <div className="mx-auto grid w-full max-w-md grid-cols-2 gap-3 md:mx-0 md:gap-4">
            <PopIn>
                <p aria-hidden className="mb-2 text-label-l">
                    Usual app
                </p>
                <PhoneFrame label="Usual app: balance $1,240.00, funds on hold">
                    <div className={`${SCREEN} bg-background-disabled text-foreground-secondary`}>
                        <span className="text-label-m">Balance</span>
                        <span className="text-heading-xs">$1,240.00</span>
                        <DropIn delay={0.5} fromTilt={-14} tilt={-3}>
                            <span className="block rounded-sm border border-dashed border-border-subtle bg-gray-200 p-1 text-center text-label-m">
                                Funds on hold
                            </span>
                        </DropIn>
                        <span>Contact support to release your funds.</span>
                    </div>
                </PhoneFrame>
            </PopIn>
            <PopIn delay={0.12}>
                <p aria-hidden className="mb-2 text-label-l">
                    Peanut
                </p>
                <PhoneFrame label="Peanut: balance $1,240.00, Send available">
                    <div className={SCREEN}>
                        <span className="text-label-m">Balance</span>
                        <span className="text-heading-xs">$1,240.00</span>
                        <span className="block rounded-full border-2 border-border-default bg-background-brand py-1 text-center text-label-m">
                            Send
                        </span>
                    </div>
                </PhoneFrame>
            </PopIn>
        </div>
    )
}
