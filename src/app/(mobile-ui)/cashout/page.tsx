import { generateMetadata } from '@/app/metadata'
import { Cashout } from '@/components'

export const dynamic = 'force-dynamic'

export const metadata = generateMetadata({
    title: 'Cash Out Crypto | Peanut',
    description: 'Convert your crypto to fiat and withdraw directly to your bank account. Fast, secure crypto offramp.',
    keywords: 'crypto cashout, offramp, crypto to bank, digital dollars, fiat withdrawal',
})

export default function CashoutPage() {
    return <Cashout />
}
