'use client'

import { useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { impactHaptic, heavyImpactHaptic, cancelHaptic } from '@/utils/haptics'
import styles from './AvatarPicker.module.css'
import { Icon } from '@/components/Global/Icons/Icon'
import { Button } from '@/components/0_Bruddle/Button'

const PIPS = [[5], [1, 9], [1, 5, 9], [1, 3, 7, 9], [1, 3, 5, 7, 9], [1, 3, 4, 6, 7, 9]]
export const DICE_ROLL_MS = 2400

export function DiceRoll({ onComplete, onCancel }: { onComplete: () => void; onCancel: () => void }) {
    const t = useTranslations('avatar')
    const completeRef = useRef(onComplete)
    completeRef.current = onComplete
    useEffect(() => {
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        const pulses = reduced
            ? []
            : [180, 430, 720, 1080, 1510, 1920].map((delay, index) =>
                  window.setTimeout(() => {
                      if (index === 5) heavyImpactHaptic()
                      else impactHaptic()
                  }, delay)
              )
        const done = window.setTimeout(() => completeRef.current(), reduced ? 200 : DICE_ROLL_MS)
        return () => {
            pulses.forEach(window.clearTimeout)
            window.clearTimeout(done)
            cancelHaptic()
        }
    }, [])
    return (
        <div className={styles.rollStage}>
            <Button
                variant="stroke"
                shape="square"
                className={styles.close}
                onClick={onCancel}
                aria-label={t('cancelRoll')}
            >
                <Icon name="cancel" size={20} />
            </Button>
            <div className={styles.scene} aria-hidden="true">
                <div className={styles.bounce}>
                    <div className={styles.die}>
                        {PIPS.map((pips, face) => (
                            <div key={face} className={styles.face} data-face={face}>
                                {Array.from({ length: 9 }, (_, cell) => (
                                    <span key={cell} className={pips.includes(cell + 1) ? styles.pip : undefined} />
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
                <div className={styles.shadow} />
                <div className={styles.impact}>
                    <i />
                    <i />
                    <i />
                    <i />
                </div>
            </div>
            <div className={styles.rollCopy} role="status">
                <p className="text-heading-l">{t('rolling')}</p>
                <p className="mt-3 text-body-m">{t('rollingHint')}</p>
            </div>
        </div>
    )
}
