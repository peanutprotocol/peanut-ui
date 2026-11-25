import ProcessingScreen from '@/components/Global/ProcessingScreen'
import { useTranslations } from 'next-intl'

/** A crypto deposit was detected and is settling. */
const DepositProcessingScreen = () => {
    const t = useTranslations('addMoney')
    return <ProcessingScreen title={t('processingDepositTitle')} description={t('processingDepositBody')} />
}

export default DepositProcessingScreen
