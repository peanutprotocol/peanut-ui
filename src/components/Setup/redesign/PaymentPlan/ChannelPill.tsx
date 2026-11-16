'use client'

import Image from 'next/image'
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
    // a brand mark (Pix, Mercado Pago since TASK-25015) shows as itself
    if (channel === 'brlBank' || channel === 'arsBank') {
        const mark = CONCEPT_ICONS[SETUP_CHANNEL_CONCEPTS[channel]]
        return 'logo' in mark ? <Image src={mark.logo} alt="" className="size-6" /> : null
    }
    return <Icon name={CHANNEL_ICON[channel]} size={20} className="text-foreground-primary" />
}

/** The drawer row's icon bubble, as dev's ChannelIcon (a bank row is green, Pix and Mercado Pago are their mark). */
function RowIcon({ channel }: { channel: SetupChannel }) {
    const concept = SETUP_CHANNEL_CONCEPTS[channel]
    const mark: ConceptIcon = CONCEPT_ICONS[concept]
    if ('logo' in mark) return <IconBubble logo={mark.logo} size="s" />
    const color: IconBubbleColor = concept === 'bank' ? 'green' : mark.color
    return <IconBubble {...mark} size="s" color={color} />
}

/**
 * A channel pill in the 08 sentence, opening a DrawerSelect (dev's ChannelPicker). The pill hugs its label, as in
 * the mock stills ("Choose" ~135 px at 390); the sentence keeps its lines because each lead word and its pill sit on
 * a line of their own (PlanSentence). The pill shrinks to its line only when that is narrower. While options load the
 * pill waits with a spinner and cannot open.
 */
export function ChannelPill<C extends SetupChannel>({
    kind,
    title,
    value,
    options,
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
            onOpen={() => {
                track(control, 'open')
                // vaul leaves focus on the pill behind the modal sheet, so Tab first walked the hidden page (review
                // R2-06). DrawerSelect does not pass Radix's onOpenAutoFocus through, so move focus to the sheet once
                // it is mounted; Radix then traps Tab inside and returns focus to the pill on close.
                requestAnimationFrame(() => {
                    const sheet = document.querySelector<HTMLElement>('[role="dialog"][data-state="open"]')
                    if (sheet && !sheet.contains(document.activeElement)) sheet.focus()
                })
            }}
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
                    <span className="block min-w-0 truncate text-left" title={shown} data-fit-label={kind}>
                        {shown}
                    </span>
                    <Icon name="chevron-down" size={20} className="shrink-0" />
                </Button>
            }
        />
    )
}
