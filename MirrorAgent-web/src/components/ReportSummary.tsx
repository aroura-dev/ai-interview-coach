import type { ReportHeaderItem } from './reportUtils'

export function ReportHeaderCards({ items }: { items: ReportHeaderItem[] }) {
  if (items.length === 0) return null
  return (
    <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
      {items.map((it) => (
        <div key={it.label} className="rounded-lg border border-gray-200 bg-white px-3 py-2">
          <div className="text-xs text-gray-500">{it.label}</div>
          <div className="mt-0.5 break-all text-sm font-medium text-gray-800">{it.value}</div>
        </div>
      ))}
    </div>
  )
}