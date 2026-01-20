'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { useModalsContext } from '@/context/ModalsContext'

const INCREASE_LIMITS_MESSAGE = 'Hi, I would like to increase my payment limits.'

/**
 * button that opens support drawer with prefilled message to request limit increase
 */
export default function IncreaseLimitsButton() {
    const { openSupportWithMessage } = useModalsContext()

    return (
        <Button className="w-full" shadowSize="4" onClick={() => openSupportWithMessage(INCREASE_LIMITS_MESSAGE)}>
            Increase my limits
        </Button>
    )
}
