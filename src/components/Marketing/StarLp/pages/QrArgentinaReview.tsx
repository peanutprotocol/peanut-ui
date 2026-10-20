import { Icon } from '@/components/Global/Icons/Icon'
import { PhoneFrame } from '@/components/Marketing/StarLp/PhoneFrame'

/**
 * The QR pay screen before you pay, with the app's own labels (qrPay.youArePaying,
 * info.exchangeRate, nav "Pay"): pesos first, dollars under them, the rate.
 * Amounts and the shop are illustrative (pricing.md quote of 22 Sep 2026 ≈ 1,565).
 */
export function QrArgentinaReview() {
    return (
        <PhoneFrame
            screen="white"
            className="max-w-[18.5rem]"
            label="Payment review: ARS 3,600, about USD 2.30, exchange rate 1 USD = 1,565 ARS, shown before you pay"
        >
            <div className="flex flex-col gap-4 px-1 py-2">
                <p className="text-center text-label-l">Pay</p>
                <div className="flex items-center gap-3 rounded-card border-2 border-border-default p-3">
                    <span
                        aria-hidden
                        className="grid size-10 shrink-0 place-items-center rounded-full border-2 border-border-default bg-avatar-orange text-body-m-semibold"
                    >
                        P
                    </span>
                    <span className="min-w-0">
                        <span className="flex items-center gap-1 text-body-xs">
                            <Icon name="arrow-up-right" size={16} />
                            Paying
                        </span>
                        <span className="block text-label-l">Panadería La Esquina</span>
                    </span>
                </div>
                <div className="text-center">
                    <span className="font-roboto-flex-extrabold block text-heading-m">ARS 3,600</span>
                    <span className="mt-1 block text-body-m-semibold">USD 2.30</span>
                </div>
                <div className="flex justify-between gap-2 border-t-2 border-dashed border-border-disabled pt-3 text-body-xs">
                    <span>Exchange rate</span>
                    <span className="font-extrabold">1 USD = 1,565 ARS</span>
                </div>
                <span className="rounded-sm border-2 border-border-default bg-background-brand py-3 text-center text-button-m shadow-4">
                    Pay
                </span>
            </div>
        </PhoneFrame>
    )
}
