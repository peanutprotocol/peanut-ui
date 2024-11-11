import { Button } from '@/components/0_Bruddle'
import BaseInput from '@/components/0_Bruddle/BaseInput'
import { useSetupFlow } from '@/components/Setup/context/SetupFlowContext'

const ContactInfo = () => {
    const { handleNext } = useSetupFlow()

    return (
        <div className="flex h-full flex-col justify-end gap-2">
            <BaseInput placeholder="Email" />
            <BaseInput placeholder="Telegram" />
            <Button
                onClick={() => {
                    handleNext()
                }}
            >
                Submit
            </Button>
        </div>
    )
}

export default ContactInfo
