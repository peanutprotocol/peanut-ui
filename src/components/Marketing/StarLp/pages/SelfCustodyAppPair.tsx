import Image from 'next/image'
import homeCapture from '@/assets/star-lp/self-custody-home.webp'
import { DropIn } from '@/components/Marketing/StarLp/DropIn'
import { PhoneFrame } from '@/components/Marketing/StarLp/PhoneFrame'
import { PopIn } from '@/components/Marketing/StarLp/PopIn'
import { SelfCustodyAppLink } from './SelfCustodyAppLink'
import { SelfCustodySendRing } from './SelfCustodySendRing'

const SCREEN = '-m-3 grid min-h-40 content-start gap-2 p-3 text-body-xs'
// The fixture's own balance, written as the app's send screen writes it; the
// home capture is retouched to the same form, so both phones show one amount.
const BALANCE = '$1,250.75'
// The stamp lands at about 0.5s + its spring; the ring follows it.
const RING_DELAY = 1.3

/**
 * Two mini phones with the same balance. On the usual app (drawn: it is no
 * real app) a "Funds on hold" stamp drops onto it; Peanut's is the real home
 * screen (fixture `home`) cropped to the balance and actions, so it reads at
 * the drawn phone's size. Its Send button rings once, and it leads to signup.
 */
export function SelfCustodyAppPair() {
    return (
        <div className="mx-auto grid w-full max-w-md grid-cols-2 gap-3 md:gap-4 lg:mr-0 lg:[zoom:1.5]">
            <PopIn>
                <p aria-hidden className="mb-2 text-label-l">
                    Usual app
                </p>
                <PhoneFrame label={`Usual app: balance ${BALANCE}, funds on hold`}>
                    <div className={`${SCREEN} bg-background-disabled text-foreground-secondary`}>
                        <span className="text-label-m">Balance</span>
                        <span className="text-heading-xs">{BALANCE}</span>
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
                <div role="img" aria-label={`Peanut: balance ${BALANCE}, Send available`}>
                    <SelfCustodyAppLink>
                        <PhoneFrame className="transition-shadow duration-instant group-active:shadow-none">
                            <div className="-m-3 grid min-h-40 content-center bg-background-page">
                                <div className="relative">
                                    <Image
                                        src={homeCapture}
                                        alt=""
                                        sizes="(min-width: 768px) 220px, 45vw"
                                        className="h-auto w-full"
                                    />
                                    {/* over the capture's Send circle */}
                                    <SelfCustodySendRing
                                        delay={RING_DELAY}
                                        className="absolute top-[64%] left-[48.4%] aspect-square w-[19%] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background-brand"
                                    />
                                </div>
                            </div>
                        </PhoneFrame>
                    </SelfCustodyAppLink>
                </div>
            </PopIn>
        </div>
    )
}
