'use client'
import RhinoDepositView from '@/components/AddMoney/views/RhinoDeposit.view'

interface AddMoneyCryptoPageProps {
    headerTitle?: string
    onBack?: () => void
    depositAddress?: string
}

const AddMoneyCryptoPage = ({ headerTitle, onBack, depositAddress }: AddMoneyCryptoPageProps) => {
    return <RhinoDepositView onBack={onBack} />
}

export default AddMoneyCryptoPage
