import { Icon } from '@/components/Global/Icons/Icon'
import { ListGroup } from './ListGroup'
import { ListItem } from './ListItem'
import { type SelectOption } from './SelectList.types'

interface SelectListProps<T extends string> {
    options: SelectOption<T>[]
    /** The chosen value; null when nothing is chosen yet. */
    value: T | null
    onSelect: (value: T) => void
}

/**
 * A single-choice list of joined rows (code-only: the selected-row rule in
 * design.md, no board). The chosen row gets the pale-blue selection fill,
 * over-color ink and a trailing check. Used inside DrawerSelect, and on its own
 * where the choice is the whole page (the settings language list).
 */
export function SelectList<T extends string>({ options, value, onSelect }: SelectListProps<T>) {
    return (
        <ListGroup>
            {options.map((option) => {
                const selected = option.value === value
                const paint = selected ? 'text-foreground-over-color-primary' : 'text-foreground-primary'
                return (
                    <ListItem
                        key={option.value}
                        // a lang row takes its name from the label span, so screen
                        // readers voice it in that language
                        aria-label={option.lang ? undefined : option.label}
                        onClick={() => onSelect(option.value)}
                        className={selected ? 'bg-background-selection' : undefined}
                        leading={option.leading}
                        title={
                            <span className={paint} lang={option.lang}>
                                {option.label}
                            </span>
                        }
                        trailing={selected ? <Icon name="check" size={20} className={paint} /> : undefined}
                    />
                )
            })}
        </ListGroup>
    )
}
