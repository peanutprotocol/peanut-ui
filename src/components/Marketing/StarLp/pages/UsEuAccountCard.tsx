import Wordmark from '@/assets/brand/wordmark.svg'
import { twMerge } from '@/utils/tw'
import type { UsEuAccountCardProps } from './usEuAccounts.types'

/** A drawn Peanut account: wordmark and flag on top, the account name, its masked details. */
export function UsEuAccountCard({ flag, label, details, tone }: UsEuAccountCardProps) {
    return (
        <div
            className={twMerge(
                'rounded-card border-2 border-border-default px-4 py-3 text-left text-foreground-primary shadow-4',
                tone === 'sky' ? 'bg-background-marketing-sky' : 'bg-background-default'
            )}
        >
            <div className="flex items-center justify-between">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={Wordmark.src}
                    width={Wordmark.width}
                    height={Wordmark.height}
                    alt="Peanut"
                    className="h-3.5 w-auto"
                />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/flags/${flag}.svg`} alt="" aria-hidden className="h-5 w-5 rounded-full object-cover" />
            </div>
            <p className="mt-2 text-heading-s">{label}</p>
            <p className="mt-0.5 text-body-s-semibold tracking-wide">{details}</p>
        </div>
    )
}
