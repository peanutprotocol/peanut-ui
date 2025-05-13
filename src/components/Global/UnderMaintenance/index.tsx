import React from 'react'
import { Card } from '@/components/0_Bruddle/Card'
import Image from 'next/image'
import Link from 'next/link'
import { PeanutGuyGIF } from '@/assets'

interface UnderMaintenanceProps {
    title?: string
    message?: string
    showImage?: boolean
    alternativeUrl?: string
}

export function UnderMaintenance({
    title = 'Under Maintenance',
    message = 'This feature is currently undergoing maintenance. Please check back later.',
    showImage = true,
    alternativeUrl,
}: UnderMaintenanceProps) {
    return (
        <div className="flex h-full w-full flex-col items-center justify-center p-4">
            <Card className="w-full max-w-md p-6">
                <div className="flex flex-col items-center gap-4 text-center">
                    {showImage && (
                        <div className="relative mb-2 h-32 w-32">
                            <Image src={PeanutGuyGIF.src} alt="Maintenance" fill className="object-contain" priority />
                        </div>
                    )}
                    <h2 className="text-xl font-bold">{title}</h2>
                    <p className="text-gray-600 dark:text-gray-400">{message}</p>
                    {alternativeUrl && (
                        <div>
                            <p className="text-gray-600 dark:text-gray-400">In the meantime, you can try:</p>
                            <Link href={alternativeUrl} target="_system">
                                {alternativeUrl}
                            </Link>
                        </div>
                    )}
                </div>
            </Card>
        </div>
    )
}
