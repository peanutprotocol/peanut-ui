type TabType = {
    title: string
    value: string
    onClick?: () => void
}

type TabsProps = {
    className?: string
    classButton?: string
    items: TabType[]
    value: number | string | undefined
    setValue: any
}

export const Tabs = ({ className, classButton, items, value, setValue }: TabsProps) => {
    const handleClick = (value: string, onClick: any) => {
        setValue(value)
        onClick?.()
    }

    return (
        <div className={` flex flex-wrap ${className}`}>
            {items.map((item, index) => (
                <button
                    className={`text-md whitespace-nowrap rounded px-5 py-1 font-bold outline-none transition-colors tap-highlight-color hover:text-grey-1  ${
                        value === item.value ? 'bg-n-1 !text-white dark:bg-white/[0.08]' : ''
                    } ${classButton}`}
                    onClick={() => handleClick(item.value, item.onClick)}
                    key={index}
                >
                    {item.title}
                </button>
            ))}
        </div>
    )
}
