'use client'

import Layout from '@/components/Global/Layout'
import { NoFees } from '@/components/LandingPage'
import Footer from '@/components/LandingPage/Footer'
import { EN_LANDING_STRINGS } from '@/components/LandingPage/landingStrings'
import { DEFAULT_LOCALE } from '@/i18n/types'
export default function ExchangePage() {
    return (
        <Layout className="enable-select !m-0 w-full !p-0">
            <NoFees
                className="flex h-full flex-col items-center justify-center"
                locale={DEFAULT_LOCALE}
                strings={EN_LANDING_STRINGS}
            />
            <Footer />
        </Layout>
    )
}
