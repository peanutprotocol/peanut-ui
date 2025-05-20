'use client'
import AvatarWithBadge from '@/components/Profile/AvatarWithBadge'
import { SearchResultCard } from '@/components/SearchUsers/SearchResultCard'
import Image from 'next/image'
import { useRouter } from 'next/navigation'

export interface DepositMethod {
    type: 'crypto' | 'country'
    id: string
    title: string
    description?: string
    iconUrl?: string
    currency?: string
    path: string
}

interface DepositMethodListProps {
    methods: DepositMethod[]
}

export const DepositMethodList = ({ methods }: DepositMethodListProps) => {
    const router = useRouter()

    const handleMethodClick = (path: string) => {
        router.push(path)
    }

    return (
        <div className="flex flex-col">
            {methods.map((method, index) => (
                <SearchResultCard
                    key={method.id}
                    title={method.title}
                    description={method.description || method.currency}
                    leftIcon={
                        method.type === 'crypto' ? (
                            <AvatarWithBadge icon="wallet-outline" size="extra-small" className="bg-yellow-5" />
                        ) : method.type === 'country' ? (
                            <Image
                                src={`https://flagcdn.com/w320/${method.id.toLowerCase()}.png`}
                                alt={`${method.title} flag`}
                                width={32}
                                height={32}
                                className="min-h-8 min-w-8 rounded-full object-fill object-center shadow-sm"
                                loading="lazy"
                            />
                        ) : (
                            <AvatarWithBadge name={method.title} size="extra-small" className="bg-yellow-5" />
                        )
                    }
                    onClick={() => handleMethodClick(method.path)}
                    position={
                        methods.length === 1
                            ? 'single'
                            : index === 0
                              ? 'first'
                              : index === methods.length - 1
                                ? 'last'
                                : 'middle'
                    }
                />
            ))}
        </div>
    )
}
