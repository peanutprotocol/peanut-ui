import { Button } from '@/components/0_Bruddle'
import BaseInput from '@/components/0_Bruddle/BaseInput'
import { Icon } from '@/components/Global/Icons/Icon'
import { MercadoPagoStep } from '@/types/manteca.types'
import { Dispatch, FC, SetStateAction } from 'react'

interface MantecaDetailsStepProps {
    setCurrentStep: Dispatch<SetStateAction<MercadoPagoStep>>
}

const MantecaDetailsStep: FC<MantecaDetailsStepProps> = ({ setCurrentStep }) => {
    return (
        <>
            <p className="font-bold">Enter Mercado Pago account details</p>

            <BaseInput placeholder="CVU or Alias" />
            <div className="flex items-center gap-2 text-xs text-grey-1">
                <Icon name="info" width={16} height={16} />
                <span>You can only withdraw to accounts under your name.</span>
            </div>

            <Button onClick={() => setCurrentStep(MercadoPagoStep.REVIEW)} shadowSize="4">
                Review
            </Button>
        </>
    )
}

export default MantecaDetailsStep
