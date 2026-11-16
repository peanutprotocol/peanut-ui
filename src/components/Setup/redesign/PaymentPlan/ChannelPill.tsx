'use client'

import Image from 'next/image'
import PIX from '@/assets/payment-apps/pix.svg'
import { Button } from '@/components/0_Bruddle/Button'
import { CONCEPT_ICONS, type ConceptIcon } from '@/components/0_Bruddle/conceptIcons'
import { DrawerSelect } from '@/components/0_Bruddle/DrawerSelect'
import { IconBubble, type IconBubbleColor } from '@/components/0_Bruddle/IconBubble'
import { Icon } from '@/components/Global/Icons/Icon'
import Loading from '@/components/Global/Loading'
import { SETUP_CHANNEL_CONCEPTS, type SetupChannel } from '@/features/setup/paymentChannels'
import { useSignupControl } from '@/features/setup/useSignupControl'
import { CHANNEL_ICON } from './channelLabels'

/** The pill's 24 px icon slot: a spinner while options load, grey "?" before a choice, else the bare icon in ink. */
function PillIcon({ channel, loading }: { channel: SetupChannel | null; loading: boolean }) {
    if (loading) return <Loading className="size-4 text-foreground-secondary" />
    if (!channel) return <Icon name="question-mark" size={20} className="text-foreground-secondary" />
    if (channel === 'brlBank') return <Image src={PIX} alt="" className="size-6" />
    return <Icon name={CHANNEL_ICON[channel]} size={20} className="text-foreground-primary" />
}

/** The drawer row's icon bubble, as dev's ChannelIcon (a bank row is green, Pix is its mark). */
function RowIcon({ channel }: { channel: SetupChannel }) {
    const concept = SETUP_CHANNEL_CONCEPTS[channel]
    const mark: ConceptIcon = CONCEPT_ICONS[concept]
    if ('logo' in mark) return <IconBubble logo={mark.logo} size="s" />
    const color: IconBubbleColor = concept === 'bank' ? 'green' : mark.color
    return <IconBubble {...mark} size="s" color={color} />
}

/**
 * A channel pill in the 08 sentence, opening a DrawerSelect (dev's ChannelPicker). Every pill label of its kind sits
 * invisibly in one grid cell, so the widest one sizes the pill in every state and after every pick, and the
 * sentence never reflows; the pill shrinks to its line only when that is narrower. While options load the pill
 * waits with a spinner and cannot open.
 */
export function ChannelPill<C extends SetupChannel>({
    kind,
    title,
    value,
    options,
    sizers,
    label,
    pillLabel,
    placeholder,
    loading,
    onChange,
}: {
    kind: 'funding' | 'payment'
    title: string
    value: C | null
    options: readonly C[]
    /** Every pill label this kind can show, for the fixed width. */
    sizers: readonly string[]
    /** The full label: drawer rows and the accessible name. */
    label: (channel: C) => string
    pillLabel: (channel: C) => string
    placeholder: string
    loading: boolean
    onChange: (channel: C) => void
}) {
    const { track } = useSignupControl()
    const control = `${kind}_channel`
    const shown = value ? pillLabel(value) : placeholder
    return (
        <DrawerSelect<C>
            title={title}
            value={value}
            onChange={(channel) => {
                track(control, 'select', channel)
                onChange(channel)
            }}
            onOpen={() => track(control, 'open')}
            onDismiss={() => track(control, 'dismiss')}
            options={options.map((channel) => ({
                value: channel,
                label: label(channel),
                leading: <RowIcon channel={channel} />,
            }))}
            trigger={
                <Button
                    variant="secondary"
                    size="compact"
                    shadowSize="2"
                    disabled={loading}
                    aria-busy={loading || undefined}
                    aria-label={`${title}: ${value ? label(value) : placeholder}`}
                    aria-haspopup="dialog"
                    data-testid={`setup-${kind}-channel`}
                    data-pill-state={loading ? 'loading' : value ? 'chosen' : 'empty'}
                    className="mx-1.5 inline-flex w-fit min-w-0 shrink signup-sm:mr-0 signup-sm:ml-1"
                    icon={<PillIcon channel={value} loading={loading} />}
                    iconContainerClassName="size-6"
                >
                    <span className="relative grid min-w-0 overflow-hidden text-left" title={shown}>
                        {[...new Set([placeholder, ...sizers])].map((text) => (
                            <span key={text} aria-hidden="true" className="invisible whitespace-nowrap [grid-area:1/1]">
                                {text}
                            </span>
                        ))}
                        <span className="block truncate [grid-area:1/1]" data-fit-label={kind}>
                            {shown}
                        </span>
                    </span>
                    <Icon name="chevron-down" size={20} className="shrink-0" />
                </Button>
            }
        />
    )
}
