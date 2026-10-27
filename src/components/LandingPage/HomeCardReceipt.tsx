import { Icon } from '@/components/Global/Icons/Icon'
import { HOME_CARD_CURRENCY, HOME_CARD_MERCHANT, HOME_CARD_NUMBER, HOME_CARD_PURCHASE_USD } from './homeCard.consts'
import type { HomeCardReceiptProps } from './homeCard.types'
import { formatUsd } from './homeHinge.utils'

/** The approved card purchase that sits on the card art, as the app's receipt shows it. */
export function HomeCardReceipt({ strings, locale }: HomeCardReceiptProps) {
    return (
        <div className="grid gap-2 rounded-card border-2 border-border-default bg-background-default px-4 py-3 shadow-4">
            <div className="flex items-center justify-between gap-3 text-body-xs whitespace-nowrap text-foreground-secondary">
                <span>{strings.receiptTitle}</span>
                <span className="flex items-center gap-2 text-label-l text-foreground-primary">
                    <span className="grid size-6 shrink-0 place-items-center rounded-full border-2 border-border-default bg-green-500 text-foreground-inverse">
                        <Icon name="check" size={16} strokeWidth={3} />
                    </span>
                    {strings.receiptApproved}
                </span>
            </div>
            <p className="font-roboto-flex-extrabold text-heading-m tabular-nums">
                {formatUsd(HOME_CARD_PURCHASE_USD, locale)}
            </p>
            <hr className="border-t border-dashed border-border-default" />
            <div className="flex justify-between gap-3 text-body-xs whitespace-nowrap text-foreground-secondary">
                <span>{HOME_CARD_MERCHANT}</span>
                <span className="text-label-l text-foreground-primary">{HOME_CARD_CURRENCY}</span>
            </div>
            <div className="flex justify-between gap-3 text-body-xs whitespace-nowrap text-foreground-secondary">
                <span>{strings.lockup}</span>
                <span data-testid="home-card-receipt-number" className="text-label-l text-foreground-primary">
                    {HOME_CARD_NUMBER}
                </span>
            </div>
        </div>
    )
}
