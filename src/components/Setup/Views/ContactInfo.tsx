import { Button, Field } from '@/components/0_Bruddle'
import { useSetupFlow } from '@/components/Setup/context/SetupFlowContext'
import { FormProvider, useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useToast } from '@/components/0_Bruddle/Toast'

const contactSchema = z.object({
    email: z.string().email('Please enter a valid email').min(1, 'Email is required'),
    telegram: z.string().min(1, 'Telegram username is required'),
})

type ContactFormData = z.infer<typeof contactSchema>

const ContactInfo = () => {
    const toast = useToast()
    const methods = useForm<ContactFormData>({
        resolver: zodResolver(contactSchema),
    })
    const {
        register,
        handleSubmit,
        formState: { errors },
    } = methods
    const { handleNext } = useSetupFlow()

    const onSubmit = handleSubmit(
        (data) => {
            console.log(data)
            handleNext()
        },
        (errors) => {
            const firstError = Object.values(errors)[0]
            if (firstError?.message) {
                toast.error(firstError.message)
            }
        }
    )

    return (
        <FormProvider {...methods}>
            <form onSubmit={onSubmit}>
                <div className="flex h-full flex-col justify-end gap-2">
                    <Field placeholder="Email" {...register('email')} autoComplete="off" />
                    <Field placeholder="Telegram" {...register('telegram')} />
                    <Button onClick={onSubmit} type="submit">
                        Submit
                    </Button>
                </div>
            </form>
        </FormProvider>
    )
}

export default ContactInfo
