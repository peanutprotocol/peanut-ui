import { generateMetadata } from '@/app/metadata'
import { Cashout, UnderMaintenance } from '@/components'
import config, { MAINTAINABLE_ROUTES } from '@/config/routesUnderMaintenance'

export const dynamic = 'force-dynamic'

export const metadata = generateMetadata({
    title: 'Cash Out | Peanut',
    description:
        'Cash out your digital dollars with Peanut. Convert to your local currency and transfer to your bank with ease.',
    keywords: 'crypto cashout, offramp, crypto to bank, digital dollars, fiat withdrawal',
})

export default function CashoutPage() {
    const isCashoutUnderMaintenance = config.routes.includes(MAINTAINABLE_ROUTES.CASHOUT)

    if (isCashoutUnderMaintenance) {
        return (
            <UnderMaintenance
                title="Cashout Temporarily Unavailable"
                message="We're improving our cashout service. Please check back soon!"
                alternativeUrl="https://peanut.to/cashout"
            />
        )
    }

    return <Cashout />
}
