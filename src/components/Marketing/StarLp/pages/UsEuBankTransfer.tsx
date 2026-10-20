import { Icon } from '@/components/Global/Icons/Icon'

/** The payer's own banking app after they send: a plain SEPA Instant confirmation. */
export function UsEuBankTransfer() {
    return (
        <div
            role="img"
            aria-label="Their bank app: instant transfer of €1,500.00 sent to your IBAN"
            className="rounded-card bg-gray-100 p-4 text-body-s text-foreground-secondary"
        >
            <p className="flex items-center gap-2 text-body-m-semibold text-foreground-primary">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-background-icon-bubble-blue text-foreground-primary">
                    <Icon name="check" size={16} />
                </span>
                Instant transfer sent
            </p>
            <p className="mt-2 text-heading-m text-foreground-primary">€1,500.00</p>
            <p>To IBAN DE•• 0420</p>
        </div>
    )
}
