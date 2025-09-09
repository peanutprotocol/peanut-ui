'use client'

import CrispChat from '@/components/CrispChat'
import { useEffect } from 'react'

export default function SupportPage() {
    useEffect(() => {
        // Ensure the page takes full height
        document.documentElement.style.height = '100%'
        document.body.style.height = '100%'
        document.body.style.margin = '0'
        document.body.style.padding = '0'
        document.body.style.overflow = 'hidden'
        
        // Cleanup on unmount
        return () => {
            document.documentElement.style.height = ''
            document.body.style.height = ''
            document.body.style.margin = ''
            document.body.style.padding = ''
            document.body.style.overflow = ''
        }
    }, [])

    return (
        <div className="h-screen w-screen">
            <CrispChat />
        </div>
    )
}
