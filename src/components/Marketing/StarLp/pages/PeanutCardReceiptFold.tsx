import { Band } from '@/components/Marketing/StarLp/Band'
import { SectionTitle } from '@/components/Marketing/StarLp/SectionTitle'
import { PeanutCardLockScreen } from './PeanutCardLockScreen'
import type { PeanutCardReceiptFoldProps } from './peanutCard.types'

/**
 * The cream fold after the hero: title and line, then the lock screen with
 * the spend's push. No bottom padding, so the fold floor cuts the phone.
 * Phones: centred, the phone under the text. md+: text left, phone right.
 */
export function PeanutCardReceiptFold({ title, line }: PeanutCardReceiptFoldProps) {
    return (
        <Band ground="cream" className="pb-0 md:pb-0">
            <div className="grid gap-9 md:grid-cols-2 md:items-center md:gap-12">
                <div className="flex flex-col gap-6 text-center md:pb-16 md:text-left">
                    <SectionTitle>{title}</SectionTitle>
                    <p className="text-body-l">{line}</p>
                </div>
                <PeanutCardLockScreen />
            </div>
        </Band>
    )
}
