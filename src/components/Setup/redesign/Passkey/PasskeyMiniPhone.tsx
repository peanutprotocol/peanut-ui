'use client'

import { motion } from 'framer-motion'
import { ScanFace } from 'lucide-react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import logo from '@/assets/brand/logo.svg'
import { ArtPiece } from '@/components/Setup/redesign/shell/ArtPiece'
import { useSetupShell } from '@/components/Setup/redesign/shell/SetupShellContext'

const PHONE_ROTATE = 4

/**
 * The small phone beside the peanut (a UI object): the Peanut tile behind a dimmed screen and the phone's own
 * sheet asking "Create a passkey?" for @username with Yes and No. It is a picture of the OS prompt; the real
 * prompt opens from the button. On the tap (`asking`) the sheet grows 10 % (mock 03-passkey playYesBeat).
 */
export function PasskeyMiniPhone({
    left,
    top,
    width,
    height,
    sheetHeight,
    username,
    asking,
}: {
    left: number
    top: number
    width: number
    height: number
    sheetHeight: number
    username: string
    asking: boolean
}) {
    const t = useTranslations('setupRedesign.passkey')
    const { reducedMotion } = useSetupShell()
    return (
        <ArtPiece
            left={left}
            top={top}
            width={width}
            height={height}
            rotate={PHONE_ROTATE}
            entrance="pop"
            delay={0.12}
            zIndex={7}
        >
            <div className="h-full w-full rounded-[26px] border-[3px] border-border-button bg-background-default p-[5px] shadow-4">
                <div className="relative h-full w-full overflow-hidden rounded-[19px] border border-border-button bg-background-page">
                    <span className="absolute top-1.5 left-1/2 z-[3] h-[9px] w-10 -translate-x-1/2 rounded-full bg-foreground-primary" />
                    <span className="absolute inset-x-0 top-7 flex flex-col items-center gap-[7px]">
                        <span className="flex size-[30px] items-center justify-center rounded-xs border border-border-button bg-background-accent-yellow">
                            <Image src={logo} alt="" className="h-[19px] w-auto" />
                        </span>
                        <i className="block h-[7px] w-[64%] rounded-full bg-background-badge-helper" />
                        <i className="block h-[7px] w-[42%] rounded-full bg-background-badge-helper" />
                    </span>
                    <span className="absolute inset-0 bg-foreground-primary/12" />
                    <motion.div
                        data-testid="passkey-mini-sheet"
                        className="absolute inset-x-0 bottom-0 z-[2] flex origin-bottom flex-col gap-2 rounded-t-[14px] bg-background-default px-[9px] pt-[7px] pb-[11px] shadow-[0_-3px_12px_rgb(0_0_0/0.16)]"
                        style={{ height: sheetHeight }}
                        initial={reducedMotion ? false : { y: '110%' }}
                        animate={{ y: 0, scale: asking && !reducedMotion ? 1.1 : 1 }}
                        transition={{ duration: 0.3, delay: asking ? 0 : 0.36, ease: [0.34, 1.56, 0.64, 1] }}
                    >
                        <span className="h-1 w-7 self-center rounded-full bg-background-badge-helper" />
                        <span className="flex items-start gap-[5px] text-base leading-5 font-extrabold text-foreground-primary">
                            <ScanFace size={18} strokeWidth={2} className="mt-px shrink-0" aria-hidden="true" />
                            <span>{t('ask')}</span>
                        </span>
                        <span className="inline-flex h-[22px] max-w-full self-start overflow-hidden rounded-full bg-background-badge-helper px-2 text-xs leading-[22px] font-bold whitespace-nowrap text-foreground-primary">
                            {`@${username}`}
                        </span>
                        <span className="mt-auto flex gap-1.5">
                            <span className="flex h-[30px] flex-1 items-center justify-center rounded-full bg-foreground-primary text-label-l text-foreground-inverse">
                                {t('yes')}
                            </span>
                            <span className="flex h-[30px] flex-1 items-center justify-center rounded-full bg-background-badge-helper text-label-l text-foreground-primary">
                                {t('no')}
                            </span>
                        </span>
                    </motion.div>
                </div>
            </div>
        </ArtPiece>
    )
}
