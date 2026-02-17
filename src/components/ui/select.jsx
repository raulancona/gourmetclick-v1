import * as React from "react"
import { Check, ChevronDown } from "lucide-react"
import { cn } from "../../lib/utils"

const SelectContext = React.createContext(null)

const Select = ({ children, value, onValueChange, disabled }) => {
    const [open, setOpen] = React.useState(false)

    // Close when clicking outside
    React.useEffect(() => {
        const handleClickOutside = (event) => {
            if (open && !event.target.closest('.select-root')) {
                setOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [open])

    return (
        <SelectContext.Provider value={{ value, onValueChange, open, setOpen, disabled }}>
            <div className="relative select-root w-full">
                {children}
            </div>
        </SelectContext.Provider>
    )
}

const SelectTrigger = React.forwardRef(({ className, children, ...props }, ref) => {
    const { open, setOpen, disabled } = React.useContext(SelectContext)

    return (
        <button
            ref={ref}
            type="button"
            onClick={() => !disabled && setOpen(!open)}
            disabled={disabled}
            className={cn(
                "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                className
            )}
            {...props}
        >
            {children}
            <ChevronDown className="h-4 w-4 opacity-50" />
        </button>
    )
})
SelectTrigger.displayName = "SelectTrigger"

const SelectValue = React.forwardRef(({ className, placeholder, ...props }, ref) => {
    const { value } = React.useContext(SelectContext)
    // We need to find the child SelectItem with this value to render its children
    // But since we can't easily access siblings here, we rely on the parent or consumer to handle display logic 
    // OR we can traverse children in SelectContent if we lifted state up differently.
    // For this simple impl, we might need a way to get the label.
    // However, robust standard Radix implementation finds the label.
    // A simplified hack: The user of this component usually passes the selected label or the component finds it.
    // In our simplified version, let's just render the value if we can't find the label easily, 
    // BUT for the specific use case in orders.jsx, the values are 'dine_in', 'pickup', etc. and labels are 'Comer aquí', etc.
    // We might need a label map or just render the value. 
    // Actually, a better approach for a simple Select without Radix is to require passing the label 
    // OR just use a registry.

    // Let's implement a registry in the context
    return (
        <span
            ref={ref}
            className={cn("block truncate", className)}
            {...props}
        >
            <ValueDisplay placeholder={placeholder} />
        </span>
    )
})
SelectValue.displayName = "SelectValue"

const ValueDisplay = ({ placeholder }) => {
    const { value, labels } = React.useContext(SelectContext)
    // This is tricky without registration. 
    // Alternative: The SelectContent children register themselves.
    // For now, let's just make it work by letting Item register.
    return <span className="select-value-text">{labels?.[value] || value || placeholder}</span>
}

// We need a way to map values to labels.
// Let's modify Select to hold a registry state.
const SelectWithRegistry = ({ children, value, onValueChange, disabled }) => {
    const [open, setOpen] = React.useState(false)
    const [labels, setLabels] = React.useState({})

    const registerLabel = React.useCallback((val, label) => {
        setLabels(prev => {
            if (prev[val] === label) return prev
            return { ...prev, [val]: label }
        })
    }, [])

    React.useEffect(() => {
        const handleClickOutside = (event) => {
            if (open && !event.target.closest('.select-root')) {
                setOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [open])

    return (
        <SelectContext.Provider value={{ value, onValueChange, open, setOpen, disabled, labels, registerLabel }}>
            <div className="relative select-root w-full">
                {children}
            </div>
        </SelectContext.Provider>
    )
}


const SelectContent = React.forwardRef(({ className, children, position = "popper", ...props }, ref) => {
    const { open } = React.useContext(SelectContext)

    if (!open) return null

    return (
        <div
            ref={ref}
            className={cn(
                "absolute z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 top-[calc(100%+4px)] w-full",
                position === "popper" &&
                "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
                className
            )}
            {...props}
        >
            <div className="w-full p-1">
                {children}
            </div>
        </div>
    )
})
SelectContent.displayName = "SelectContent"

const SelectItem = React.forwardRef(({ className, children, value: itemValue, ...props }, ref) => {
    const { value, onValueChange, setOpen, registerLabel } = React.useContext(SelectContext)

    // Register label safely
    React.useEffect(() => {
        if (registerLabel && children) {
            // Very basic text extraction
            const text = typeof children === 'string' ? children : String(children)
            registerLabel(itemValue, children)
        }
    }, [itemValue, children, registerLabel])

    return (
        <div
            ref={ref}
            className={cn(
                "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 hover:bg-accent hover:text-accent-foreground cursor-pointer",
                value === itemValue && "bg-accent/50",
                className
            )}
            onClick={(e) => {
                e.stopPropagation()
                onValueChange(itemValue)
                setOpen(false)
            }}
            {...props}
        >
            <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                {value === itemValue && <Check className="h-4 w-4" />}
            </span>
            <span className="truncate">{children}</span>
        </div>
    )
})
SelectItem.displayName = "SelectItem"

// Export SelectWithRegistry as Select
export { SelectWithRegistry as Select, SelectTrigger, SelectValue, SelectContent, SelectItem }
