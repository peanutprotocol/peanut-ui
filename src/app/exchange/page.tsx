'use client'

import Layout from '@/components/Global/Layout'
import { NoFees } from '@/components/LandingPage'
import Footer from '@/components/LandingPage/Footer'
export default function ExchangePage() {
    return (
        <Layout className="enable-select !m-0 w-full !p-0">
            <NoFees />
            <Footer />
        </Layout>
    )
}
