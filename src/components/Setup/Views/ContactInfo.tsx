import { Button, Field } from '@/components/0_Bruddle'
import { useToast } from '@/components/0_Bruddle/Toast'
import { useAuth } from '@/context/authContext'
import { useSetupFlow } from '@/hooks/useSetupFlow'
import { yupResolver } from '@hookform/resolvers/yup'
import { useMutation } from '@tanstack/react-query'
import { FormProvider, useForm } from 'react-hook-form'
import * as yup from 'yup'
import { fetchWithSentry } from '@/utils'

const contactSchema = yup.object({
    contact: yup
        .string()
        .required('Please enter an email or Telegram username')
        .test('isValidContact', 'Please enter a valid email or Telegram username', (value) => {
            if (!value) return true
            const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
            const isTelegram = /^@?[\w\d]{5,32}$/.test(value)
            return isEmail || isTelegram
        }),
})

type ContactFormData = yup.InferType<typeof contactSchema>

const ContactInfo = () => {
    const toast = useToast()
    const { userId } = useAuth()

    const { mutate: updateUser, isPending } = useMutation({
        mutationKey: ['update-user-', userId],
        mutationFn: async ({ contact }: ContactFormData) => {
            const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)

            const response = await fetchWithSentry('/api/peanut/user/update-user', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: isEmail ? contact : undefined,
                    telegram: !isEmail ? contact : undefined,
                    userId,
                }),
            })

            if (!response.ok) {
                throw new Error('Failed to update contact info')
            }

            return response.json()
        },
        onError: (error) => {
            console.error('Error updating user', error)
            toast.error('Failed to update contact info')
        },
        onSuccess: () => {
            handleNext()
        },
    })
    const methods = useForm<ContactFormData>({
        resolver: yupResolver(contactSchema),
    })
    const {
        register,
        handleSubmit,
        formState: { errors },
    } = methods
    const { handleNext } = useSetupFlow()

    const onSubmit = handleSubmit(
        (data) => {
            updateUser(data)
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
                    <Field placeholder="telegram / email" {...register('contact')} />
                    <Button loading={isPending} disabled={isPending} onClick={onSubmit} type="submit">
                        Submit
                    </Button>
                </div>
            </form>
        </FormProvider>
    )
}

export default ContactInfo
