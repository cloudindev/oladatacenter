/**
 * List filters, as a plain GET form.
 *
 * No client JavaScript and no Server Action: the filter state lives in the query string,
 * so a filtered list is a URL an operator can bookmark, paste into an incident channel or
 * reload after a deploy. Every dashboard tile links straight into one of these.
 */
import * as React from "react"
import Link from "next/link"
import { Button, Input, Select } from "@/components/app/ui"

export interface FilterOption {
  value: string
  label: string
}

export function FilterBar({
  action,
  children,
  reset,
}: {
  /** The route the form submits to, e.g. `/admin/pedidos`. */
  action: string
  children: React.ReactNode
  /** Shown as "quitar filtros" when anything is applied. */
  reset?: boolean
}) {
  return (
    <form
      method="get"
      action={action}
      className="mb-5 flex flex-wrap items-end gap-3 rounded-xl border border-border-base bg-surface-light p-4"
    >
      {children}
      <Button type="submit" variant="secondary">
        Filtrar
      </Button>
      {reset ? (
        <Link
          href={action}
          className="label-mono inline-flex h-11 items-center px-3 text-text-muted hover:text-text-base"
        >
          Quitar filtros
        </Link>
      ) : null}
    </form>
  )
}

export function FilterSelect({
  name,
  label,
  value,
  options,
}: {
  name: string
  label: string
  value: string
  options: readonly FilterOption[]
}) {
  return (
    <label className="block">
      <span className="label-mono mb-1.5 block text-text-muted">{label}</span>
      <Select name={name} defaultValue={value} className="min-w-[10rem]">
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </label>
  )
}

export function FilterText({
  name,
  label,
  value,
  placeholder,
}: {
  name: string
  label: string
  value: string
  placeholder?: string
}) {
  return (
    <label className="block">
      <span className="label-mono mb-1.5 block text-text-muted">{label}</span>
      <Input
        type="search"
        name={name}
        defaultValue={value}
        placeholder={placeholder}
        className="min-w-[14rem]"
        autoComplete="off"
      />
    </label>
  )
}

export function FilterDate({
  name,
  label,
  value,
}: {
  name: string
  label: string
  value: string
}) {
  return (
    <label className="block">
      <span className="label-mono mb-1.5 block text-text-muted">{label}</span>
      <Input type="date" name={name} defaultValue={value} className="min-w-[9rem]" />
    </label>
  )
}
