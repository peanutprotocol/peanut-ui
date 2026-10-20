const ROWS = [
    ['Peanut fee to make it', '$0.00'],
    ['Peanut fee to pay it', '$0.00'],
    ['Amount', 'Any'],
    ['Expires', 'Never'],
] as const

const TEETH_ID = 'request-links-receipt-teeth'

/** Fold 4: the request terms as a till receipt (request-links.md: free, no limits, no expiry). */
export function RequestLinksReceipt() {
    return (
        // 336 px is 21 teeth, so the zigzag meets both side borders at a full tooth.
        <div className="mx-auto w-full max-w-[336px]">
            <div className="border-x-2 border-t-2 border-border-default bg-background-default px-4 pt-6 pb-6 font-mono text-body-s">
                <p className="text-center font-extraBlack tracking-widest">*** PEANUT REQUEST ***</p>
                <dl className="mt-3">
                    {ROWS.map(([label, value], i) => (
                        <div
                            key={label}
                            className={`flex justify-between gap-2 py-2 ${i < ROWS.length - 1 ? 'border-b-2 border-dashed border-border-subtle' : ''}`}
                        >
                            <dt>{label}</dt>
                            <dd className="font-extraBlack">{value}</dd>
                        </div>
                    ))}
                </dl>
                <p className="mt-3 text-body-xs">Their exchange or wallet may charge its usual fee.</p>
                <p className="mt-4 text-center text-body-xs">THANK YOU · COME AGAIN</p>
            </div>
            {/* The torn edge: white teeth with a thin outline and no offset shadow, as in the approved mock. */}
            <svg aria-hidden className="block h-[10px] w-full">
                <defs>
                    <pattern id={TEETH_ID} width="16" height="10" patternUnits="userSpaceOnUse">
                        <path d="M0 0 L8 9 L16 0 Z" className="fill-background-default" />
                        <path d="M0 0 L8 9 L16 0" fill="none" className="stroke-border-default" strokeWidth="2" />
                    </pattern>
                </defs>
                <rect width="100%" height="10" fill={`url(#${TEETH_ID})`} />
            </svg>
        </div>
    )
}
