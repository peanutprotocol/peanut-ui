'use client'

import { useState, useCallback } from 'react'
import BaseInput from '@/components/0_Bruddle/BaseInput'
import BaseSelect from '@/components/0_Bruddle/BaseSelect'
import { Button } from '@/components/0_Bruddle/Button'
import { Card } from '@/components/0_Bruddle/Card'
import Checkbox from '@/components/0_Bruddle/Checkbox'
import { Field } from '@/components/0_Bruddle/Field'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { Callout } from '@/components/0_Bruddle/Callout'
import PageContainer from '@/components/0_Bruddle/PageContainer'
import { TitleBlock } from '@/components/0_Bruddle/TitleBlock'
import Loading from '@/components/Global/Loading'
import EmptyState from '@/components/Global/EmptyStates/EmptyState'
import { useAuth } from '@/context/authContext'
import { IS_DEV } from '@/constants/general.consts'
import InvitesGraph from '@/components/Global/InvitesGraph'
import { DEFAULT_FORCE_CONFIG } from '@/components/Global/InvitesGraph/types'
import { parseBoundedNumber } from './number-input'

// Allowed users for full graph access (frontend check - backend also validates)
const ALLOWED_USERNAMES = ['squirrel', 'kkonrad', 'hugo']

export default function FullGraphPage() {
    const { user, isFetchingUser } = useAuth()
    const [apiKey, setApiKey] = useState('')
    const [apiKeySubmitted, setApiKeySubmitted] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleApiKeySubmit = useCallback(() => {
        if (!apiKey.trim()) {
            setError('Please enter an API key')
            return
        }
        setError(null)
        setApiKeySubmitted(true)
    }, [apiKey])

    const handleClose = useCallback(() => {
        window.location.href = '/dev'
    }, [])

    // Check if user is allowed (frontend defense - backend also validates)
    // In dev mode, allow all users; in prod, restrict to allowed usernames
    const isAllowedUser =
        IS_DEV || (user?.user?.username && ALLOWED_USERNAMES.includes(user.user.username.toLowerCase()))

    // Loading state
    if (isFetchingUser) {
        return (
            <PageContainer alignItems="center" className="fixed inset-0 z-50 bg-background-disabled px-4">
                <Loading />
            </PageContainer>
        )
    }

    // Access denied screen
    if (!isAllowedUser) {
        return (
            <PageContainer alignItems="center" className="fixed inset-0 z-50 bg-background-disabled px-4">
                <EmptyState
                    icon="lock"
                    title="Access restricted"
                    description="This tool is only available to authorized users."
                    cta={<LinkButton href="/dev">Back to dev tools</LinkButton>}
                />
            </PageContainer>
        )
    }

    // API key input screen
    if (!apiKeySubmitted) {
        return (
            <PageContainer alignItems="center" className="fixed inset-0 z-50 bg-background-disabled px-4">
                <Card className="w-full max-w-md gap-6 p-6">
                    <TitleBlock
                        align="center"
                        size="s"
                        title="Full graph"
                        description="Enter the admin API key to visualize the network."
                    />
                    {error && <Callout priority="error">{error}</Callout>}
                    <Field label="Admin API key">
                        <BaseInput
                            type="password"
                            value={apiKey}
                            onChange={(event) => setApiKey(event.target.value)}
                            onKeyDown={(event) => event.key === 'Enter' && handleApiKeySubmit()}
                        />
                    </Field>
                    <Button onClick={handleApiKeySubmit} className="w-full">
                        Enter graph
                    </Button>
                    <LinkButton href="/dev" className="self-center">
                        Back to dev tools
                    </LinkButton>
                </Card>
            </PageContainer>
        )
    }

    return (
        <div className="fixed inset-0 z-50 flex flex-col">
            <InvitesGraph
                apiKey={apiKey}
                onClose={handleClose}
                width={typeof window !== 'undefined' ? window.innerWidth : 1200}
                height={typeof window !== 'undefined' ? window.innerHeight - 120 : 800}
                renderOverlays={({
                    showUsernames,
                    setShowUsernames,
                    topNodes,
                    setTopNodes,
                    activityFilter,
                    setActivityFilter,
                    forceConfig,
                    setForceConfig,
                    visibilityConfig,
                    setVisibilityConfig,
                    externalNodesConfig,
                    setExternalNodesConfig,
                    externalNodes,
                    externalNodesLoading,
                    externalNodesError,
                    handleReset,
                    handleRecalculate,
                    hiddenStatuses,
                    setHiddenStatuses,
                }) => (
                    <>
                        {/* Controls Panel - Top Right */}
                        <Card
                            className="absolute top-4 right-4 left-4 max-h-[calc(100vh_-_140px)] overflow-y-auto p-3 sm:left-auto sm:w-64"
                            shadowSize="4"
                        >
                            {/* FORCES + VISIBILITY merged */}
                            <h3 className="mb-2 text-label-m">Display & Forces</h3>

                            <div className="space-y-2 text-body-xs">
                                {/* Scale indicator */}
                                <div className="-mb-1 flex justify-between text-label-m text-foreground-secondary">
                                    <span>0.1×</span>
                                    <span>1×</span>
                                    <span>10×</span>
                                </div>

                                {/* Repulsion Force */}
                                <div className="space-y-0.5">
                                    <div className="flex items-center justify-between">
                                        <Checkbox
                                            label="Repulsion force"
                                            value={forceConfig.charge.enabled}
                                            onChange={(e) =>
                                                setForceConfig({
                                                    ...forceConfig,
                                                    charge: { ...forceConfig.charge, enabled: e.target.checked },
                                                })
                                            }
                                        />
                                        {forceConfig.charge.enabled && (
                                            <span className="text-label-m text-foreground-secondary">
                                                {(
                                                    forceConfig.charge.strength / DEFAULT_FORCE_CONFIG.charge.strength
                                                ).toFixed(1)}
                                                x
                                            </span>
                                        )}
                                    </div>
                                    {forceConfig.charge.enabled && (
                                        <BaseInput
                                            variant="sm"
                                            type="number"
                                            min="-1"
                                            max="1"
                                            step="0.05"
                                            value={Math.log10(
                                                forceConfig.charge.strength / DEFAULT_FORCE_CONFIG.charge.strength
                                            )}
                                            onChange={(e) => {
                                                const exponent = parseBoundedNumber(e.target.value, -1, 1)
                                                if (exponent === null) return
                                                setForceConfig({
                                                    ...forceConfig,
                                                    charge: {
                                                        ...forceConfig.charge,
                                                        strength:
                                                            DEFAULT_FORCE_CONFIG.charge.strength *
                                                            Math.pow(10, exponent),
                                                    },
                                                })
                                            }}
                                        />
                                    )}
                                </div>

                                {/* Invite Force + Edges (merged) */}
                                <div className="space-y-0.5">
                                    <div className="flex items-center justify-between">
                                        <Checkbox
                                            label="Invite force and edges"
                                            value={forceConfig.inviteLinks.enabled}
                                            onChange={(e) => {
                                                setForceConfig({
                                                    ...forceConfig,
                                                    inviteLinks: {
                                                        ...forceConfig.inviteLinks,
                                                        enabled: e.target.checked,
                                                    },
                                                })
                                                setVisibilityConfig({
                                                    ...visibilityConfig,
                                                    inviteEdges: e.target.checked,
                                                })
                                            }}
                                        />
                                        {forceConfig.inviteLinks.enabled && (
                                            <span className="text-label-m text-foreground-secondary">
                                                {(
                                                    forceConfig.inviteLinks.strength /
                                                    DEFAULT_FORCE_CONFIG.inviteLinks.strength
                                                ).toFixed(1)}
                                                x
                                            </span>
                                        )}
                                    </div>
                                    {forceConfig.inviteLinks.enabled && (
                                        <BaseInput
                                            variant="sm"
                                            type="number"
                                            min="-1"
                                            max="1"
                                            step="0.05"
                                            value={Math.log10(
                                                forceConfig.inviteLinks.strength /
                                                    DEFAULT_FORCE_CONFIG.inviteLinks.strength
                                            )}
                                            onChange={(e) => {
                                                const exponent = parseBoundedNumber(e.target.value, -1, 1)
                                                if (exponent === null) return
                                                setForceConfig({
                                                    ...forceConfig,
                                                    inviteLinks: {
                                                        ...forceConfig.inviteLinks,
                                                        strength:
                                                            DEFAULT_FORCE_CONFIG.inviteLinks.strength *
                                                            Math.pow(10, exponent),
                                                    },
                                                })
                                            }}
                                        />
                                    )}
                                </div>

                                {/* P2P Force + Edges (merged) */}
                                <div className="space-y-0.5">
                                    <div className="flex items-center justify-between">
                                        <Checkbox
                                            label="P2P force and edges"
                                            value={forceConfig.p2pLinks.enabled}
                                            onChange={(e) => {
                                                setForceConfig({
                                                    ...forceConfig,
                                                    p2pLinks: {
                                                        ...forceConfig.p2pLinks,
                                                        enabled: e.target.checked,
                                                    },
                                                })
                                                setVisibilityConfig({
                                                    ...visibilityConfig,
                                                    p2pEdges: e.target.checked,
                                                })
                                            }}
                                        />
                                        {forceConfig.p2pLinks.enabled && (
                                            <span className="text-label-m text-foreground-secondary">
                                                {(
                                                    forceConfig.p2pLinks.strength /
                                                    DEFAULT_FORCE_CONFIG.p2pLinks.strength
                                                ).toFixed(1)}
                                                x
                                            </span>
                                        )}
                                    </div>
                                    {forceConfig.p2pLinks.enabled && (
                                        <BaseInput
                                            variant="sm"
                                            type="number"
                                            min="-1"
                                            max="1"
                                            step="0.05"
                                            value={Math.log10(
                                                forceConfig.p2pLinks.strength / DEFAULT_FORCE_CONFIG.p2pLinks.strength
                                            )}
                                            onChange={(e) => {
                                                const exponent = parseBoundedNumber(e.target.value, -1, 1)
                                                if (exponent === null) return
                                                setForceConfig({
                                                    ...forceConfig,
                                                    p2pLinks: {
                                                        ...forceConfig.p2pLinks,
                                                        strength:
                                                            DEFAULT_FORCE_CONFIG.p2pLinks.strength *
                                                            Math.pow(10, exponent),
                                                    },
                                                })
                                            }}
                                        />
                                    )}
                                </div>

                                {/* Center Force (unified) */}
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                        <Checkbox
                                            label="Center force"
                                            value={forceConfig.center?.enabled ?? DEFAULT_FORCE_CONFIG.center.enabled}
                                            onChange={(e) =>
                                                setForceConfig({
                                                    ...forceConfig,
                                                    center: {
                                                        ...(forceConfig.center || DEFAULT_FORCE_CONFIG.center),
                                                        enabled: e.target.checked,
                                                    },
                                                })
                                            }
                                        />
                                        {(forceConfig.center?.enabled ?? DEFAULT_FORCE_CONFIG.center.enabled) && (
                                            <span className="text-label-m text-foreground-secondary">
                                                {(
                                                    (forceConfig.center?.strength ??
                                                        DEFAULT_FORCE_CONFIG.center.strength) /
                                                    DEFAULT_FORCE_CONFIG.center.strength
                                                ).toFixed(1)}
                                                x
                                            </span>
                                        )}
                                    </div>
                                    {(forceConfig.center?.enabled ?? DEFAULT_FORCE_CONFIG.center.enabled) && (
                                        <>
                                            {/* strength control */}
                                            <div className="space-y-0.5 pl-4">
                                                <div className="flex justify-between text-label-m text-foreground-secondary">
                                                    <span>Strength</span>
                                                </div>
                                                <BaseInput
                                                    variant="sm"
                                                    type="number"
                                                    min="-1"
                                                    max="1"
                                                    step="0.05"
                                                    value={Math.log10(
                                                        (forceConfig.center?.strength ??
                                                            DEFAULT_FORCE_CONFIG.center.strength) /
                                                            DEFAULT_FORCE_CONFIG.center.strength
                                                    )}
                                                    onChange={(e) => {
                                                        const exponent = parseBoundedNumber(e.target.value, -1, 1)
                                                        if (exponent === null) return
                                                        setForceConfig({
                                                            ...forceConfig,
                                                            center: {
                                                                ...(forceConfig.center || DEFAULT_FORCE_CONFIG.center),
                                                                strength:
                                                                    DEFAULT_FORCE_CONFIG.center.strength *
                                                                    Math.pow(10, exponent),
                                                            },
                                                        })
                                                    }}
                                                />
                                            </div>
                                            {/* size bias: 0=uniform, 9=big nodes get 10x pull */}
                                            <div className="space-y-0.5 pl-4">
                                                <div className="flex justify-between text-label-m text-foreground-secondary">
                                                    <span>Size Bias</span>
                                                    <span>
                                                        {(
                                                            1 +
                                                            (forceConfig.center?.sizeBias ??
                                                                DEFAULT_FORCE_CONFIG.center.sizeBias)
                                                        ).toFixed(1)}
                                                        x
                                                    </span>
                                                </div>
                                                <BaseInput
                                                    variant="sm"
                                                    type="number"
                                                    min="0"
                                                    max="9"
                                                    step="0.5"
                                                    value={
                                                        forceConfig.center?.sizeBias ??
                                                        DEFAULT_FORCE_CONFIG.center.sizeBias
                                                    }
                                                    onChange={(e) => {
                                                        const sizeBias = parseBoundedNumber(e.target.value, 0, 9)
                                                        if (sizeBias === null) return
                                                        setForceConfig({
                                                            ...forceConfig,
                                                            center: {
                                                                ...(forceConfig.center || DEFAULT_FORCE_CONFIG.center),
                                                                sizeBias,
                                                            },
                                                        })
                                                    }}
                                                />
                                                <div className="flex justify-between text-label-m text-foreground-secondary">
                                                    <span>1x uniform</span>
                                                    <span>10x big→center</span>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* Divider */}
                                <div className="my-1 border-t"></div>

                                {/* External Nodes Section */}
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <Checkbox
                                            label="External nodes"
                                            value={externalNodesConfig.enabled}
                                            onChange={(e) =>
                                                setExternalNodesConfig({
                                                    ...externalNodesConfig,
                                                    enabled: e.target.checked,
                                                })
                                            }
                                        />
                                        <span className="text-label-m text-foreground-secondary">experimental</span>
                                        {externalNodesLoading && (
                                            <span className="ml-auto animate-pulse text-label-m">loading…</span>
                                        )}
                                        {!externalNodesLoading &&
                                            !externalNodesError &&
                                            externalNodesConfig.enabled && (
                                                <span className="ml-auto text-label-m">{externalNodes.length}</span>
                                            )}
                                    </div>
                                    {externalNodesError && externalNodesConfig.enabled && (
                                        <Callout priority="error">Failed to load. Check the console.</Callout>
                                    )}
                                    {!externalNodesError && externalNodesConfig.enabled && (
                                        <div className="space-y-2 pl-4">
                                            {/* Min connections - discrete options */}
                                            <Field label="Minimum users">
                                                <BaseSelect
                                                    value={String(externalNodesConfig.minConnections)}
                                                    onValueChange={(value) =>
                                                        setExternalNodesConfig({
                                                            ...externalNodesConfig,
                                                            minConnections: Number(value),
                                                        })
                                                    }
                                                    aria-label="Minimum connected users"
                                                    options={[1, 2, 3, 5, 10, 20, 50].map((value) => ({
                                                        label: String(value),
                                                        value: String(value),
                                                    }))}
                                                />
                                            </Field>
                                            {/* Type filters */}
                                            <div className="flex flex-wrap gap-2">
                                                <Checkbox
                                                    label="Wallet"
                                                    value={externalNodesConfig.types.WALLET}
                                                    onChange={(e) =>
                                                        setExternalNodesConfig({
                                                            ...externalNodesConfig,
                                                            types: {
                                                                ...externalNodesConfig.types,
                                                                WALLET: e.target.checked,
                                                            },
                                                        })
                                                    }
                                                />
                                                <Checkbox
                                                    label="Bank"
                                                    value={externalNodesConfig.types.BANK}
                                                    onChange={(e) =>
                                                        setExternalNodesConfig({
                                                            ...externalNodesConfig,
                                                            types: {
                                                                ...externalNodesConfig.types,
                                                                BANK: e.target.checked,
                                                            },
                                                        })
                                                    }
                                                />
                                                <Checkbox
                                                    label="Merchant"
                                                    value={externalNodesConfig.types.MERCHANT}
                                                    onChange={(e) =>
                                                        setExternalNodesConfig({
                                                            ...externalNodesConfig,
                                                            types: {
                                                                ...externalNodesConfig.types,
                                                                MERCHANT: e.target.checked,
                                                            },
                                                        })
                                                    }
                                                />
                                            </div>
                                            {/* External link force strength */}
                                            <div className="space-y-0.5">
                                                <div className="flex items-center justify-between">
                                                    <Checkbox
                                                        label="Link force"
                                                        value={
                                                            forceConfig.externalLinks?.enabled ??
                                                            DEFAULT_FORCE_CONFIG.externalLinks.enabled
                                                        }
                                                        onChange={(e) =>
                                                            setForceConfig({
                                                                ...forceConfig,
                                                                externalLinks: {
                                                                    ...(forceConfig.externalLinks ||
                                                                        DEFAULT_FORCE_CONFIG.externalLinks),
                                                                    enabled: e.target.checked,
                                                                },
                                                            })
                                                        }
                                                    />
                                                    {(forceConfig.externalLinks?.enabled ??
                                                        DEFAULT_FORCE_CONFIG.externalLinks.enabled) && (
                                                        <span className="text-label-m text-foreground-secondary">
                                                            {(
                                                                (forceConfig.externalLinks?.strength ??
                                                                    DEFAULT_FORCE_CONFIG.externalLinks.strength) /
                                                                DEFAULT_FORCE_CONFIG.externalLinks.strength
                                                            ).toFixed(1)}
                                                            x
                                                        </span>
                                                    )}
                                                </div>
                                                {(forceConfig.externalLinks?.enabled ??
                                                    DEFAULT_FORCE_CONFIG.externalLinks.enabled) && (
                                                    <BaseInput
                                                        variant="sm"
                                                        type="number"
                                                        min="-1"
                                                        max="1"
                                                        step="0.05"
                                                        value={Math.log10(
                                                            (forceConfig.externalLinks?.strength ??
                                                                DEFAULT_FORCE_CONFIG.externalLinks.strength) /
                                                                DEFAULT_FORCE_CONFIG.externalLinks.strength
                                                        )}
                                                        onChange={(e) => {
                                                            const exponent = parseBoundedNumber(e.target.value, -1, 1)
                                                            if (exponent === null) return
                                                            setForceConfig({
                                                                ...forceConfig,
                                                                externalLinks: {
                                                                    ...(forceConfig.externalLinks ||
                                                                        DEFAULT_FORCE_CONFIG.externalLinks),
                                                                    strength:
                                                                        DEFAULT_FORCE_CONFIG.externalLinks.strength *
                                                                        Math.pow(10, exponent),
                                                                },
                                                            })
                                                        }}
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Divider */}
                                <div className="my-1 border-t"></div>

                                {/* Node visibility */}
                                <div className="flex flex-wrap gap-3">
                                    <Checkbox
                                        label="Active"
                                        value={visibilityConfig.activeNodes}
                                        onChange={(e) =>
                                            setVisibilityConfig({
                                                ...visibilityConfig,
                                                activeNodes: e.target.checked,
                                            })
                                        }
                                    />
                                    <Checkbox
                                        label="Inactive"
                                        value={visibilityConfig.inactiveNodes}
                                        onChange={(e) =>
                                            setVisibilityConfig({
                                                ...visibilityConfig,
                                                inactiveNodes: e.target.checked,
                                            })
                                        }
                                    />
                                </div>

                                {/* Other options */}
                                <Checkbox
                                    label="Names"
                                    value={showUsernames}
                                    onChange={(event) => setShowUsernames(event.target.checked)}
                                />

                                {/* top nodes control */}
                                <div className="space-y-0.5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-body-xs">Top nodes:</span>
                                        <span className="text-label-m text-foreground-secondary">
                                            {topNodes === 0 ? 'All' : topNodes.toLocaleString()}
                                        </span>
                                    </div>
                                    <BaseInput
                                        variant="sm"
                                        type="number"
                                        min="0"
                                        max="10000"
                                        step="500"
                                        value={topNodes}
                                        onChange={(e) => {
                                            const value = parseBoundedNumber(e.target.value, 0, 10000)
                                            if (value !== null) setTopNodes(Math.round(value))
                                        }}
                                    />
                                    <div className="flex justify-between text-label-m text-foreground-secondary">
                                        <span>All</span>
                                        <span>5k</span>
                                        <span>10k</span>
                                    </div>
                                </div>

                                {/* Activity window */}
                                <Field label="Active window">
                                    <BaseSelect
                                        value={String(activityFilter.activityDays)}
                                        onValueChange={(value) =>
                                            setActivityFilter({
                                                ...activityFilter,
                                                activityDays: Number(value),
                                                enabled: true,
                                            })
                                        }
                                        aria-label="Active window"
                                        options={[7, 14, 30, 60, 90].map((value) => ({
                                            label: `${value}d`,
                                            value: String(value),
                                        }))}
                                    />
                                </Field>

                                {/* Action buttons */}
                                <div className="flex flex-col gap-3">
                                    <Button
                                        variant="stroke"
                                        size="small"
                                        onClick={handleRecalculate}
                                        title="Recalculate layout with current settings"
                                        icon="retry"
                                    >
                                        Recalculate
                                    </Button>
                                    <Button
                                        variant="stroke"
                                        size="small"
                                        onClick={handleReset}
                                        title="Reset all settings to defaults"
                                    >
                                        Defaults
                                    </Button>
                                </div>
                            </div>

                            {/* Compact Legend — click to toggle visibility */}
                            <div className="mt-3 border-t pt-2">
                                <div className="space-y-1 text-label-m text-foreground-secondary">
                                    {/* Nodes — clickable toggles */}
                                    <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                                        {(
                                            [
                                                {
                                                    key: 'new',
                                                    label: 'New',
                                                    color: 'rgba(74, 222, 128, 0.85)',
                                                    border: false,
                                                },
                                                {
                                                    key: 'active',
                                                    label: 'Active',
                                                    color: 'rgba(255, 144, 232, 0.85)',
                                                    border: false,
                                                },
                                                {
                                                    key: 'inactive',
                                                    label: 'Inactive',
                                                    color: 'rgba(145, 145, 145, 0.7)',
                                                    border: false,
                                                },
                                                {
                                                    key: 'jailed',
                                                    label: 'Jailed',
                                                    color: 'rgba(156, 163, 175, 0.85)',
                                                    border: true,
                                                },
                                            ] as const
                                        ).map(({ key, label, color, border }) => (
                                            <Checkbox
                                                key={key}
                                                value={!hiddenStatuses.has(key)}
                                                onChange={() => {
                                                    const next = new Set(hiddenStatuses)
                                                    if (next.has(key)) next.delete(key)
                                                    else next.add(key)
                                                    setHiddenStatuses(next)
                                                }}
                                                label={
                                                    <span className="flex items-center gap-1">
                                                        <span
                                                            className="inline-block size-2 rounded-full"
                                                            style={{
                                                                backgroundColor: color,
                                                                border: border
                                                                    ? '1px solid var(--color-border-default)'
                                                                    : undefined,
                                                            }}
                                                        />
                                                        {label}
                                                    </span>
                                                }
                                            />
                                        ))}
                                    </div>
                                    {/* External nodes */}
                                    {externalNodesConfig.enabled && (
                                        <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                                            <span className="flex items-center gap-0.5">
                                                <span className="inline-block h-2 w-2 rotate-45 bg-background-icon-bubble-yellow"></span>
                                                Wallet
                                            </span>
                                            <span className="flex items-center gap-0.5">
                                                <span className="inline-block h-2 w-2 bg-background-icon-bubble-blue"></span>
                                                Bank
                                            </span>
                                            <span className="flex items-center gap-0.5">
                                                <span
                                                    className="inline-block h-2 w-2 bg-background-badge-accent"
                                                    style={{
                                                        clipPath:
                                                            'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                                                    }}
                                                ></span>
                                                Merchant
                                            </span>
                                        </div>
                                    )}
                                    {/* Edges */}
                                    <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                                        <span className="flex items-center gap-0.5">
                                            <span className="inline-block h-0.5 w-3"></span>Invite
                                        </span>
                                        <span className="flex items-center gap-0.5">
                                            <span className="inline-block h-0.5 w-3 bg-action-primary/50"></span>Payment
                                        </span>
                                        <span className="flex items-center gap-0.5">
                                            <span className="inline-block h-0.5 w-3"></span>P2P
                                        </span>
                                    </div>
                                    <p>Click → Select | Right-click → Focus</p>
                                    {topNodes > 0 && <p>Showing top {topNodes.toLocaleString()} nodes</p>}
                                </div>
                            </div>
                        </Card>
                    </>
                )}
            />
        </div>
    )
}
