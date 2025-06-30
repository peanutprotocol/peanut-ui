import PaymentLayoutWrapper from './payment-layout-wrapper'

export default function PaymentLayout({ children }: { children: React.ReactNode }) {
    return <PaymentLayoutWrapper>{children}</PaymentLayoutWrapper>
}
