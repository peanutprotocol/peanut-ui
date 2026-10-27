import Image from 'next/image'
import MercadoPagoIcon from '@/assets/payment-apps/mercado-pago.svg'
import { PhoneFrame } from '@/components/Marketing/StarLp/PhoneFrame'
import { QR_AR_MERCHANT, QR_AR_PRICE_ARS } from '@/components/Marketing/StarLp/pages/qrArgentina.consts'
import { US_EU_EUR_IN } from '@/components/Marketing/StarLp/pages/usEuAccounts.consts'
import { t } from '@/i18n/interpolate'
import { HomeBalanceActivityRow } from './HomeBalanceActivityRow'
import { HOME_BALANCE_USD, HOME_QR_OUT_USD, HOME_QR_RAIL, HOME_SEPA_IN_USD, HOME_SEPA_RAIL } from './homeHinge.consts'
import type { HomeBalanceScreenProps } from './homeHinge.types'
import { formatArs, formatEur, formatSignedUsd, formatUsd } from './homeHinge.utils'

/**
 * The one balance screen of the hinge: euros in by SEPA (the us-eu timeline),
 * a QR lunch out in Argentina (the qr-ar pay screen). Static amounts, so no
 * rate wording anywhere. The frame is an image with one spoken summary.
 */
export function HomeBalanceScreen({ strings, locale }: HomeBalanceScreenProps) {
    const balance = formatUsd(HOME_BALANCE_USD, locale)
    const eur = formatEur(US_EU_EUR_IN, locale)
    const usdIn = formatSignedUsd(HOME_SEPA_IN_USD, 'in', locale)
    const ars = formatArs(QR_AR_PRICE_ARS, locale)
    const usdOut = formatSignedUsd(HOME_QR_OUT_USD, 'out', locale)
    // "US$ 1.670,19" leaves no room beside a title even at lg, so the localized screens stack every amount
    const stacked = locale !== 'en'

    return (
        // lg zooms the whole phone (as QrArgentinaReview does) so it balances the title; md columns are too narrow.
        // min-w-0: as a grid item the phone never grows past its column for a long localized amount.
        <PhoneFrame
            label={t(strings.screenLabel, { balance, eur, usdIn, merchant: QR_AR_MERCHANT, ars, usdOut })}
            className="min-w-0 lg:[zoom:1.3]"
        >
            <p className="mt-2 text-center text-body-xs text-foreground-secondary">{strings.balance}</p>
            <p className="font-roboto-flex-extrabold text-center text-heading-l tabular-nums">{balance}</p>
            <p className="mt-2 text-body-xs text-foreground-secondary">{strings.activity}</p>
            <HomeBalanceActivityRow
                icon="€"
                title={strings.moneyIn}
                detail={`${HOME_SEPA_RAIL} · ${eur}`}
                amount={usdIn}
                tone="in"
                stacked={stacked}
            />
            <HomeBalanceActivityRow
                icon={<Image src={MercadoPagoIcon} alt="" width={24} height={24} className="size-6" />}
                title={QR_AR_MERCHANT}
                detail={`${HOME_QR_RAIL} · ${ars}`}
                amount={usdOut}
                tone="out"
                stacked={stacked}
            />
        </PhoneFrame>
    )
}
