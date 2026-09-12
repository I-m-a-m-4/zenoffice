"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

type ComboboxOption = { label: string; value: string; flag?: string }

type ComboboxProps = {
  options: ComboboxOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyPlaceholder?: string
  triggerClassName?: string
  /** Overrides the default "match the trigger width" sizing of the popover. */
  contentClassName?: string
  itemClassName?: string
  disabled?: boolean
  avoidCollisions?: boolean
  sideOffset?: number
  modal?: boolean
  renderSelected?: (option: ComboboxOption) => React.ReactNode
  renderItem?: (option: ComboboxOption) => React.ReactNode
}

export function Combobox({
  options,
  value,
  onChange,
  placeholder = "Select an option...",
  searchPlaceholder = "Search...",
  emptyPlaceholder = "No results found.",
  triggerClassName,
  contentClassName,
  itemClassName,
  disabled = false,
  avoidCollisions = true,
  sideOffset = 4,
  modal = false,
  renderSelected,
  renderItem,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const selectedOption = options.find((option) => option.value === value)

  return (
    <Popover open={open} onOpenChange={!disabled ? setOpen : undefined} modal={modal}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", triggerClassName)}
          disabled={disabled}
        >
          {selectedOption
            ? (renderSelected ? renderSelected(selectedOption) : selectedOption.label)
            : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        avoidCollisions={avoidCollisions}
        sideOffset={sideOffset}
        className={cn("p-0", contentClassName ?? "w-full")}
        // An inline width always beats a class, so callers that pass their own
        // sizing get a floor instead — the panel can grow past a narrow trigger.
        style={
          contentClassName
            ? { minWidth: "var(--radix-popover-trigger-width)" }
            : { width: "var(--radix-popover-trigger-width)" }
        }
      >
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyPlaceholder}</CommandEmpty>
            <CommandGroup>
              {options.map((option, index) => (
                <CommandItem
                  key={`${option.value}-${index}`}
                  value={option.label}
                  onSelect={() => {
                    onChange(option.value === value ? "" : option.value)
                    setOpen(false)
                  }}
                  className={cn("cursor-pointer", itemClassName)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 shrink-0",
                      value === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {renderItem ? renderItem(option) : option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
