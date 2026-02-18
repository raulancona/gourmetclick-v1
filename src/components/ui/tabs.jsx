import * as React from "react"
import { cn } from "../../lib/utils"

const TabsContext = React.createContext(null)

const Tabs = ({ defaultValue, value, onValueChange, className, children, ...props }) => {
    const [selectedTab, setSelectedTab] = React.useState(value || defaultValue)

    React.useEffect(() => {
        if (value !== undefined) {
            setSelectedTab(value)
        }
    }, [value])

    const handleTabChange = (newValue) => {
        setSelectedTab(newValue)
        if (onValueChange) {
            onValueChange(newValue)
        }
    }

    return (
        <TabsContext.Provider value={{ value: selectedTab, onValueChange: handleTabChange }}>
            <div className={cn("w-full", className)} {...props}>
                {children}
            </div>
        </TabsContext.Provider>
    )
}

const TabsList = React.forwardRef(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn(
            "inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground",
            className
        )}
        {...props}
    />
))
TabsList.displayName = "TabsList"

const TabsTrigger = React.forwardRef(({ className, value, ...props }, ref) => {
    const { value: selectedValue, onValueChange } = React.useContext(TabsContext)
    const isSelected = selectedValue === value

    return (
        <button
            ref={ref}
            type="button"
            role="tab"
            aria-selected={isSelected}
            data-state={isSelected ? "active" : "inactive"}
            onClick={() => onValueChange(value)}
            className={cn(
                "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
                className
            )}
            {...props}
        />
    )
})
TabsTrigger.displayName = "TabsTrigger"

const TabsContent = React.forwardRef(({ className, value, children, ...props }, ref) => {
    const { value: selectedValue } = React.useContext(TabsContext)
    const isSelected = selectedValue === value

    if (!isSelected) return null

    return (
        <div
            ref={ref}
            role="tabpanel"
            className={cn(
                "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                className
            )}
            {...props}
        >
            {children}
        </div>
    )
})
TabsContent.displayName = "TabsContent"

export { Tabs, TabsList, TabsTrigger, TabsContent }
