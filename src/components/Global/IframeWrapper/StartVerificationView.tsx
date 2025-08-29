'use client'

import { ThinkingPeanut } from '@/assets'
import { Button } from '@/components/0_Bruddle'
import CloudsBackground from '@/components/0_Bruddle/CloudsBackground'
import Image from 'next/image'

const StartVerificationView = ({ onStartVerification }: { onStartVerification: () => void }) => {
    return (
        <div className="flex h-full w-full flex-col">
            <div className="relative flex h-[45%] items-center justify-center bg-secondary-3/100">
                <CloudsBackground minimal />
                <Image
                    src={ThinkingPeanut.src}
                    alt="verification"
                    className="relative w-full max-w-72 object-contain md:max-w-80"
                    height={100}
                    width={100}
                />
            </div>

            <div className="flex h-[55%] flex-col bg-white p-4">
                <h1 className="text-3xl font-extrabold">Secure Verification. Limited Data Use.</h1>
                <div>
                    <p className="mt-2 text-lg font-medium">
                        The verification is done by Persona, which only shares a yes/no with Peanut.
                    </p>
                    <p className="text-lg font-medium">
                        Persona is trusted by millions and it operates under strict security and privacy standards.
                    </p>
                    <p className="text-lg font-bold">Peanut never sees or stores your verification data.</p>
                </div>
                <Button onClick={onStartVerification} className="my-auto" variant="purple" shadowSize="4">
                    Start Secure Verification
                </Button>
            </div>
        </div>
    )
}

export default StartVerificationView
