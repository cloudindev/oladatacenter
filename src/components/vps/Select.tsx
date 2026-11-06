"use client"

/**
 * Styled single-choice select for the configurator.
 *
 * Native <select> popups are drawn by the operating system and ignore the site's styles,
 * so this follows the WAI-ARIA "select-only combobox" pattern instead: a button with
 * `role="combobox"` that opens a `role="listbox"`. Keyboard: Enter/Space/ArrowDown open,
 * arrows and Home/End move, Enter/Space pick, Escape/Tab close, typing jumps to a match.
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react"
import { cn } from "@/lib/utils"

export interface SelectOption {
  value: string
  label: string
  /** Shown right-aligned in the list, e.g. "+ 6,99 € / mes". */
  hint?: string
}

export function Select({
  options,
  value,
  onChange,
  ariaLabel,
  disabled = false,
  className,
}: {
  options: readonly SelectOption[]
  value: string
  onChange: (value: string) => void
  ariaLabel: string
  disabled?: boolean
  className?: string
}) {
  const id = useId()
  const listId = `${id}-list`
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const typed = useRef({ text: "", at: 0 })

  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  )
  const selected = options[selectedIndex]

  useEffect(() => {
    if (!open) return
    function onPointer(event: PointerEvent): void {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener("pointerdown", onPointer)
    return () => document.removeEventListener("pointerdown", onPointer)
  }, [open])

  useEffect(() => {
    if (!open) return
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" })
  }, [open, active])

  function openList(): void {
    if (disabled) return
    setActive(selectedIndex)
    setOpen(true)
  }

  function pick(index: number): void {
    const option = options[index]
    if (!option) return
    onChange(option.value)
    setOpen(false)
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>): void {
    if (disabled) return
    const last = options.length - 1
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault()
        if (!open) openList()
        else setActive((current) => Math.min(last, current + 1))
        return
      case "ArrowUp":
        event.preventDefault()
        if (!open) openList()
        else setActive((current) => Math.max(0, current - 1))
        return
      case "Home":
        if (open) {
          event.preventDefault()
          setActive(0)
        }
        return
      case "End":
        if (open) {
          event.preventDefault()
          setActive(last)
        }
        return
      case "Enter":
      case " ":
        event.preventDefault()
        if (open) pick(active)
        else openList()
        return
      case "Escape":
        if (open) {
          event.preventDefault()
          setOpen(false)
        }
        return
      case "Tab":
        setOpen(false)
        return
      default:
        if (event.key.length === 1 && /\S/.test(event.key)) {
          const now = Date.now()
          const text = (now - typed.current.at > 600 ? "" : typed.current.text) + event.key
          typed.current = { text, at: now }
          const match = options.findIndex((option) =>
            option.label.toLowerCase().includes(text.toLowerCase()),
          )
          if (match >= 0) {
            if (open) setActive(match)
            else onChange(options[match]?.value ?? value)
          }
        }
    }
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? `${id}-opt-${active}` : undefined}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        className={cn(
          "flex h-11 w-full items-center justify-between gap-3 rounded-lg border bg-surface-light px-3.5 text-left text-[14px] text-text-base transition-colors",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink",
          open ? "border-bg-dark/40" : "border-bg-dark/15 hover:border-bg-dark/35",
          disabled && "cursor-not-allowed opacity-60 hover:border-bg-dark/15",
        )}
      >
        <span className="truncate">{selected?.label ?? ""}</span>
        <svg
          viewBox="0 0 16 16"
          aria-hidden
          className={cn("size-4 shrink-0 opacity-60 transition-transform", open && "rotate-180")}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        >
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>

      {open ? (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={ariaLabel}
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 max-h-72 overflow-auto rounded-xl border border-bg-dark/12 bg-surface-light p-1.5 shadow-[0_12px_32px_-12px_rgba(34,47,48,0.35)]"
        >
          {options.map((option, index) => {
            const isSelected = option.value === value
            const isActive = index === active
            return (
              <li
                key={option.value}
                id={`${id}-opt-${index}`}
                data-index={index}
                role="option"
                aria-selected={isSelected}
                onPointerEnter={() => setActive(index)}
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => pick(index)}
                className={cn(
                  "flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-[14px] text-text-base",
                  isSelected ? "bg-primary" : isActive ? "bg-surface-beige" : "",
                )}
              >
                <span className="flex size-4 shrink-0 items-center justify-center">
                  {isSelected ? (
                    <svg viewBox="0 0 16 16" aria-hidden className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 8.5l3 3 7-7" />
                    </svg>
                  ) : null}
                </span>
                <span className="flex-1 truncate">{option.label}</span>
                {option.hint ? (
                  <span className="shrink-0 font-mono text-[11.5px] tabular-nums text-text-muted">
                    {option.hint}
                  </span>
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
