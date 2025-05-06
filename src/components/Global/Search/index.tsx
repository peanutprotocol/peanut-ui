import Icon from '@/components/Global/Icon'

type SearchProps = {
    className?: string
    placeholder: string
    value: string
    onChange: any
    onSubmit: any
    large?: boolean
    medium?: boolean
    border?: boolean
}

const Search = ({ className, placeholder, value, onChange, onSubmit, large, medium, border }: SearchProps) => {
    return (
        <div className={`relative ${className} ${large ? 'shadow-4 w-full' : ''}`}>
            <input
                className={`w-full rounded-none bg-transparent text-base outline-none
                transition-colors placeholder:text-base focus:border-primary-1 dark:border-white dark:text-white dark:placeholder:text-white/75 dark:focus:border-primary-1 ${
                    large
                        ? 'h-16 bg-white pl-6 pr-18 text-base font-medium dark:bg-n-1'
                        : medium
                          ? 'h-12 pl-6 pr-8 text-base font-medium dark:bg-n-1 dark:text-white'
                          : 'h-8 pl-8 pr-4 text-base font-bold'
                } ${border && 'border border-n-1'}`}
                type="text"
                placeholder={placeholder}
                value={value}
                onChange={onChange}
            />
            <button
                className={`absolute text-0 ${
                    large
                        ? 'right-5 top-1/2 h-8 w-8 -translate-y-1/2 border border-n-1 bg-primary-1 transition-colors hover:bg-primary-1/90'
                        : 'bottom-0 left-0 top-0 w-8'
                }`}
            >
                <Icon className="dark:fill-white" name="search" />
            </button>{' '}
        </div>
    )
}

export default Search
