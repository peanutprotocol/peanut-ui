'use client'

import { PEANUT_LOGO_BLACK, PEANUTMAN_LOGO } from '@/assets'
import { Button } from '@/components/0_Bruddle'
import Image from 'next/image'
import React from 'react'

interface CreateAccountButtonProps {
    onClick: () => void
}

const CreateAccountButton = ({ onClick }: CreateAccountButtonProps) => {
    return (
        <Button onClick={onClick} shadowSize="4">
            <div>Create a</div>
            <div className="flex items-center gap-1">
                <Image src={PEANUTMAN_LOGO} alt="Peanut Logo" className="size-5" />
                <Image src={PEANUT_LOGO_BLACK} alt="Peanut Logo" />
            </div>
            <div>account</div>
        </Button>
    )
}

export default CreateAccountButton
