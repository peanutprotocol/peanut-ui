import PaymentLayoutWrapper from './payment-layout-wrapper'
import { isReservedRoute } from '@/constants/routes'
import { notFound } from 'next/navigation'

type PaymentLayoutProps = {
    children: React.ReactNode
    params: Promise<{ recipient?: string[] }>
}

export default async function PaymentLayout({ children, params }: PaymentLayoutProps) {
    const { recipient = [] } = await params
    const firstSegment = recipient[0]

    // The catch-all page repeats this guard for direct callers, but the layout
    // must reject reserved/localized paths first. Otherwise its client shell
    // reads Redux and modal contexts before the page can call notFound(), while
    // localized marketing URLs intentionally omit those app providers.
    if (firstSegment && isReservedRoute(`/${firstSegment}`)) {
        notFound()
    }

    return <PaymentLayoutWrapper>{children}</PaymentLayoutWrapper>
}
