import PaymentLayoutWrapper from '@/app/[...recipient]/payment-layout-wrapper'

export default function PayLayout({ children }: { children: React.ReactNode }) {
    return <PaymentLayoutWrapper>{children}</PaymentLayoutWrapper>
}
