'use client'

import { PEANUT_LOGO_BLACK, PEANUTMAN } from '@/assets'
import { Button } from '@/components/0_Bruddle/Button'
import { useTranslations } from 'next-intl'
import Image from 'next/image'

interface CreateAccountButtonProps {
    onClick: () => void
}

const CreateAccountButton = ({ onClick }: CreateAccountButtonProps) => {
    const t = useTranslations('global')
    return (
        <Button onClick={onClick} shadowSize="4">
            {t.rich('createAccountButton.label', {
                logo: () => (
                    <div className="flex items-center gap-1">
                        <Image src={PEANUTMAN} alt="Peanut Logo" className="size-5" />
                        <Image src={PEANUT_LOGO_BLACK} alt="Peanut Logo" />
                    </div>
                ),
            })}
        </Button>
    )
}

export default CreateAccountButton
