'use client'

import React, { ReactNode, useCallback, useState } from 'react'
import { twMerge } from 'tailwind-merge'

import { Button } from '@/components/0_Bruddle'
import BaseInput from '@/components/0_Bruddle/BaseInput'
import Divider from '@/components/0_Bruddle/Divider'
import BottomDrawer from '@/components/Global/BottomDrawer'
import Card, { CardPosition } from '@/components/Global/Card'
import { Icon } from '../Icons/Icon'

const popularNetworks = [
    { name: 'ARB', icon: 'arbitrum' },
    { name: 'ETH', icon: 'ethereum' },
    { name: 'BASE', icon: 'base' },
]

const popularTokens = [
    { name: 'USDC', icon: 'usdc' },
    { name: 'USDT', icon: 'usdt' },
    { name: 'ETH', icon: 'ethereum' },
]

interface SectionProps {
    title: string
    children: ReactNode
    className?: string
}

const Section: React.FC<SectionProps> = ({ title, children, className }) => (
    <div className={twMerge('space-y-2', className)}>
        <h2 className="text-md font-bold text-black">{title}</h2>
        {children}
    </div>
)

interface NetworkButtonProps {
    name: string
    icon?: ReactNode
    onClick: () => void
    isSearch?: boolean
}

const NetworkButton: React.FC<NetworkButtonProps> = ({ name, icon, onClick, isSearch = false }) => (
    <Button
        className="shadow-2 flex h-fit flex-1 flex-col items-center justify-center gap-1 bg-white p-3 text-center hover:bg-grey-1/10"
        onClick={onClick}
    >
        <div
            className={twMerge(
                'flex h-6 min-h-6 w-6 items-center justify-center rounded-full text-xs',
                isSearch ? 'bg-black text-white' : 'bg-gray-300'
            )}
        >
            {isSearch ? <Icon name="search" size={16} /> : icon}
        </div>
        <span className="text-sm font-medium">{name}</span>
    </Button>
)

interface TokenListItemProps {
    name: string
    icon?: ReactNode
    onClick: () => void
    position?: CardPosition
    className?: string
}

const TokenListItem: React.FC<TokenListItemProps> = ({ name, icon, onClick, position = 'single', className }) => (
    <Card
        position={position}
        className={twMerge('shadow-4 rounded-none border-black p-4', className)}
        onClick={onClick}
    >
        <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-500 text-sm text-white">
                    {icon || name.substring(0, 1).toUpperCase()}
                </div>
                <span className="text-sm font-medium text-black">{name}</span>
            </div>
            <Icon name="chevron-up" size={32} className="h-8 w-8 rotate-90 text-black" />
        </div>
    </Card>
)

interface NewTokenSelectorProps {
    classNameButton?: string
    onTokenSelect?: (token: any) => void
    onNetworkSelect?: (network: any) => void
}

const NewTokenSelector: React.FC<NewTokenSelectorProps> = ({ classNameButton, onTokenSelect, onNetworkSelect }) => {
    const [isDrawerOpen, setIsDrawerOpen] = useState(false)
    const [searchValue, setSearchValue] = useState('')

    const openDrawer = useCallback(() => setIsDrawerOpen(true), [])
    const closeDrawer = useCallback(() => setIsDrawerOpen(false), [])

    const handleTokenSelect = useCallback(
        (token: any) => {
            console.log('Token selected:', token.name)
            onTokenSelect?.(token)
            closeDrawer()
        },
        [onTokenSelect, closeDrawer]
    )

    const handleNetworkSelect = useCallback(
        (network: any) => {
            console.log('Network selected:', network.name)
            onNetworkSelect?.(network)
        },
        [onNetworkSelect]
    )

    const handleFreeTokenSelect = useCallback(() => {
        console.log('Free token selected')
        closeDrawer()
    }, [closeDrawer])

    const handleSearchNetwork = useCallback(() => {
        console.log('Search networks clicked')
    }, [])

    return (
        <>
            <Button
                variant="primary-soft"
                onClick={openDrawer}
                className={twMerge('flex items-center justify-between', classNameButton)}
            >
                <span>Select Token</span>
                <Icon
                    name="chevron-up"
                    className={`h-4 w-4 transition-transform ${!isDrawerOpen ? 'rotate-180' : ''}`}
                />
            </Button>

            <BottomDrawer
                isOpen={isDrawerOpen}
                onClose={closeDrawer}
                initialPosition="expanded"
                handleTitle=""
                expandedHeight={95}
                halfHeight={60}
                collapsedHeight={10}
            >
                <div className="flex flex-col space-y-6 pb-10">
                    <Section title="Free transaction token!">
                        <Card
                            className="bg-purple-light shadow-4 border border-black p-3"
                            onClick={handleFreeTokenSelect}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                    <div className="relative h-8 w-8">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500 text-white">
                                            $
                                        </div>
                                        <div className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border border-white bg-gray-700 text-xs text-white">
                                            A
                                        </div>
                                    </div>
                                    <div>
                                        <p className="font-semibold text-black">USDC on Arbitrum</p>
                                        <p className="text-sm text-gray-600">No gas fees with this token.</p>
                                    </div>
                                </div>
                                <Icon name="chevron-up" size={32} className="h-8 w-8 rotate-90 text-black" />
                            </div>
                        </Card>
                    </Section>

                    <Divider className="p-0" />

                    <Section title="Select a network">
                        <div className="flex items-stretch justify-between space-x-2">
                            {popularNetworks.map((network) => (
                                <NetworkButton
                                    key={network.name}
                                    name={network.name}
                                    icon={network.name.substring(0, 3).toUpperCase()}
                                    onClick={() => handleNetworkSelect(network)}
                                />
                            ))}
                            <NetworkButton name="Search" isSearch={true} onClick={handleSearchNetwork} />
                        </div>
                    </Section>

                    <Divider className="p-0" dividerClassname="border-grey-1" />

                    <Section title="Select a token" className="space-y-4">
                        <div className="relative">
                            <BaseInput
                                variant="md"
                                className="h-14 w-full border border-black px-10"
                                placeholder="Search for a token"
                                value={searchValue}
                                onChange={(e) => setSearchValue(e.target.value)}
                            />
                            <Icon name="search" className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2" />
                            {searchValue && (
                                <Button
                                    variant="transparent"
                                    onClick={() => setSearchValue('')}
                                    className="absolute right-2 top-1/2 w-fit -translate-y-1/2 p-0"
                                >
                                    <Icon name="cancel" className="h-5 w-5" />
                                </Button>
                            )}
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center space-x-1">
                                <span className="text-sm font-semibold text-gray-600">⭐ Popular tokens</span>
                            </div>
                            <div className="flex flex-col gap-4">
                                {popularTokens.map((token, index) => (
                                    <TokenListItem
                                        key={token.name + index}
                                        name={token.name}
                                        icon={token.name.substring(0, 1).toUpperCase()}
                                        onClick={() => handleTokenSelect(token)}
                                    />
                                ))}
                            </div>
                        </div>
                    </Section>
                </div>
            </BottomDrawer>
        </>
    )
}

export default NewTokenSelector
