import { useTranslations } from 'next-intl'
import { GenericBanner } from './GenericBanner'

export function MaintenanceBanner() {
    const t = useTranslations('global')
    return <GenericBanner message={t('maintenanceBanner')} icon="⚠️" />
}
