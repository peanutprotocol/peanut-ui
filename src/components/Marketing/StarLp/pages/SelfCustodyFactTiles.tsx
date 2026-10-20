import { PopIn } from '@/components/Marketing/StarLp/PopIn'
import { SelfCustodyPasskeyGlyph } from './SelfCustodyPasskeyGlyph'

const CROP =
    'grid h-24 content-center gap-1 overflow-hidden rounded-sm border border-border-default bg-background-page p-2 text-body-xs lg:h-28 lg:p-3 lg:text-body-s'
const LABEL = 'mt-3 text-heading-xs text-balance uppercase lg:text-heading-s'

/** Four app crops, each under a one-line fact. They pop in one after another. */
export function SelfCustodyFactTiles() {
    const tiles = [
        {
            id: 'owner',
            crop: (
                <div className={CROP}>
                    <span className="text-label-m">Account owner</span>
                    <span className="text-heading-xs">You</span>
                </div>
            ),
            label: 'Your own account',
        },
        {
            id: 'key',
            crop: (
                <div className={CROP}>
                    <span className="text-label-m">Passkey created</span>
                    <span className="text-foreground-secondary">Saved on this iPhone</span>
                </div>
            ),
            label: 'Your key, not ours',
        },
        {
            id: 'approve',
            crop: (
                <div className={`${CROP} justify-items-center text-center`}>
                    <SelfCustodyPasskeyGlyph className="h-6 w-6" />
                    <span className="text-label-m">Send $120.00 to Ana?</span>
                </div>
            ),
            label: 'You approve every send',
        },
        {
            id: 'freeze',
            crop: (
                <div className={CROP}>
                    <span className="text-label-m">Balance</span>
                    <span className="text-heading-xs">$1,240.00</span>
                    <span className="text-label-m text-green-800">Available</span>
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
                        {/* the drawn crop is decoration; the fact label is the readable text */}
                        <div aria-hidden>{tile.crop}</div>
                        <p className={LABEL}>{tile.label}</p>
                    </PopIn>
                </li>
            ))}
        </ul>
    )
}
