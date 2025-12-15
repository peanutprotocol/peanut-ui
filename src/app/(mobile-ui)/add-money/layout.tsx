import PageContainer from '@/components/0_Bruddle/PageContainer'
import { generateMetadata } from '@/app/metadata'

export const metadata = generateMetadata({
    title: 'Add Money | Peanut',
    description:
        'Add funds to your Peanut account and start sending and receiving digital dollars instantly. Top up easily with any token on any chain, or use google pay, apple pay, and others.',
})

export default function AddMoneyLayout({ children }: { children: React.ReactNode }) {
    return <PageContainer>{children}</PageContainer>
}
