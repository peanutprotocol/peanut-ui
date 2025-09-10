import { Button } from '@/components/0_Bruddle'
import MantecaDetailsCard, { MantecaCardRow } from '@/components/Global/MantecaDetailsCard'
import { MercadoPagoStep } from '@/types/manteca.types'
import { Dispatch, FC, SetStateAction } from 'react'

interface MantecaReviewStepProps {
    setCurrentStep: Dispatch<SetStateAction<MercadoPagoStep>>
}

const MantecaReviewStep: FC<MantecaReviewStepProps> = ({ setCurrentStep }) => {
    const detailsCardRows: MantecaCardRow[] = [
        {
            key: 'fullName',
            label: 'Full name',
            value: 'Manuel Rodríguez Roldán',
            allowCopy: true,
        },
        {
            key: 'cuilCuit',
            label: '[CUIL/CUIT]',
            value: '20-39951628-6',
            allowCopy: true,
        },
        {
            key: 'alias',
            label: 'Alias',
            value: 'manurr.mp',
            allowCopy: true,
        },
        {
            key: 'exchangeRate',
            label: 'Exchange Rate',
            value: '1 USD = 1200 ARS',
            allowCopy: true,
        },
        {
            key: 'fee',
            label: 'Fee',
            value: '1000',
            allowCopy: true,
            hideBottomBorder: true,
        },
    ]

    return (
        <>
            <MantecaDetailsCard rows={detailsCardRows} />
            <Button shadowSize="4" onClick={() => setCurrentStep(MercadoPagoStep.SUCCESS)}>
                Withdraw
            </Button>
        </>
    )
}

export default MantecaReviewStep
