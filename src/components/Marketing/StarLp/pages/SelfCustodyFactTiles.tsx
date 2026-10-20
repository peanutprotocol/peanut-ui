import Image from 'next/image'
import balanceCrop from '@/assets/star-lp/self-custody-tile-balance.webp'
import ownerCrop from '@/assets/star-lp/self-custody-tile-owner.webp'
import passkeyCrop from '@/assets/star-lp/self-custody-tile-passkey.webp'
import { PopIn } from '@/components/Marketing/StarLp/PopIn'
import { SelfCustodyApproveCrop } from './SelfCustodyApproveCrop'

const CROP =
    'flex h-24 items-center justify-center overflow-hidden rounded-sm border border-border-default p-1.5 lg:h-28'
const CROP_IMAGE = 'h-auto max-h-full w-auto max-w-full'
const CROP_SIZES = '(min-width: 1024px) 220px, (min-width: 768px) 300px, 45vw'
const LABEL = 'mt-3 text-heading-xs text-balance uppercase lg:text-heading-s'

/**
 * Four crops of real app screens (see the capture script), each under a
 * one-line fact. They pop in one after another. The tiles are facts, not
 * buttons, so none of them reacts to a press.
 */
export function SelfCustodyFactTiles() {
    const tiles = [
        {
            id: 'owner',
            // profile header (fixture `profile`, retouched to the page's own persona)
            crop: (
                <div className={`${CROP} bg-background-page`}>
                    <Image src={ownerCrop} alt="" sizes={CROP_SIZES} className={CROP_IMAGE} />
                </div>
            ),
            label: 'Your own account',
        },
        {
            id: 'key',
            // the app's own passkey explainer, shown during signup
            crop: (
                <div className={`${CROP} bg-background-default`}>
                    <Image src={passkeyCrop} alt="" sizes={CROP_SIZES} className={CROP_IMAGE} />
                </div>
            ),
            label: 'Your key, not ours',
        },
        {
            id: 'approve',
            crop: <SelfCustodyApproveCrop className={`${CROP} relative bg-background-page`} />,
            label: 'You approve every send',
        },
        {
            id: 'freeze',
            // home balance (fixture `home`)
            crop: (
                <div className={`${CROP} bg-background-page`}>
                    <Image src={balanceCrop} alt="" sizes={CROP_SIZES} className={CROP_IMAGE} />
                </div>
            ),
            label: "Peanut can't freeze it",
        },
    ]
    return (
        <ul className="mx-auto grid w-full max-w-md grid-cols-2 gap-3 md:mx-0 md:max-w-none md:gap-4 lg:grid-cols-4 lg:gap-6">
            {tiles.map((tile, i) => (
                <li key={tile.id}>
                    <PopIn
                        delay={i * 0.12}
                        className="h-full rounded-sm border-2 border-border-default bg-background-default p-2 shadow-4 lg:p-3"
                    >
                        {/* the crop is decoration; the fact label is the readable text */}
                        <div aria-hidden>{tile.crop}</div>
                        <p className={LABEL}>{tile.label}</p>
                    </PopIn>
                </li>
            ))}
        </ul>
    )
}
