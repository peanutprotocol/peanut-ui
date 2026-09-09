'use client'

import { useTranslations } from 'next-intl'
import Loading from '@/components/Global/Loading'
import CyclingLoading from '@/components/Global/Loading/CyclingLoading'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'
import { loadingStateKey } from '@/i18n/app/loading-states'
import { QrPayFlowProvider, useQrPayFlow } from './QrPayFlowContext'
import type { QrPayScanParams } from './qr-pay-flow.types'
import { QrPayStatusView } from './views/QrPayStatusView'
import { QrPayFormView } from './views/QrPayFormView'
import { QrPaySuccessView } from './views/QrPaySuccessView'
import { QrPayKycGateView } from './views/QrPayKycGateView'
import { QrPayProviderRejectionView } from './views/QrPayProviderRejectionView'
import { QrPayBlockedView } from './views/QrPayBlockedView'
import { QrPayPageLoading } from './views/QrPayPageLoading'

// internal component that switches views — the precedence itself lives in
// deriveQrPayView, so this stays a flat map from view to component
function QrPayFlowContent() {
    const { view, loadingState } = useQrPayFlow()
    const t = useAppTranslations('qrPay')
    const tLoading = useTranslations('loadingStates')

    switch (view) {
        case 'KYC_LOADING':
            return <Loading variant="mascot" />
        case 'PROVIDER_REJECTION':
            return <QrPayProviderRejectionView />
        case 'KYC_GATE':
            return <QrPayKycGateView />
        case 'MAINTENANCE':
        case 'INIT_ERROR':
        case 'ORDER_NOT_READY':
            return <QrPayBlockedView />
        case 'AWAITING_MERCHANT':
            return <QrPayPageLoading message={t('waitingForMerchant')} />
        case 'LOADING':
            if (loadingState === 'Paying') return <CyclingLoading />
            /*
             * Captioned only for the retry window. A scan being retried after a
             * stalled request is otherwise pixel-identical to a slow first attempt,
             * and it is the silent spinner that sends people to ask the cashier.
             * Every other state keeps the bare mascot it has always had.
             */
            if (loadingState === 'Still fetching details') {
                return <QrPayPageLoading message={tLoading(loadingStateKey(loadingState))} />
            }
            return <Loading variant="mascot" />
        case 'STATUS':
            return <QrPayStatusView />
        case 'SUCCESS':
            return <QrPaySuccessView />
        case 'FORM':
        default:
            return <QrPayFormView />
    }
}

// exported page component with provider; the entry route keys this on the
// scan (qrCode + timestamp) so a new scan starts from clean state
export function QrPayPage({ qrCode, timestamp, qrType, pixKey }: QrPayScanParams) {
    return (
        <QrPayFlowProvider qrCode={qrCode} timestamp={timestamp} qrType={qrType} pixKey={pixKey}>
            <QrPayFlowContent />
        </QrPayFlowProvider>
    )
}
