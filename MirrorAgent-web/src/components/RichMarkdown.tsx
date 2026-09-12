import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

type Block =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'table'; header: string[]; rows: string[][]; raw: string }
  | { kind: 'md'; text: string }

function splitRow(line: string): string[] {
  return line.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map((c) => c.trim())
}

function isSep(line: string): boolean {
  const cells = splitRow(line)
  return cells.length > 0 && cells.every((c) => /^:?-{2,}:?$/.test(c))
}

function clean(s: string): string {
  return s.replace(/\*\*/g, '').trim()
}

function parseBlocks(md: string): Block[] {
  const lines = md.split('\n')
  const blocks: Block[] = []
  let acc: string[] = []
  const flush = () => {
    if (acc.length) {
      blocks.push({ kind: 'md', text: acc.join('\n') })
      acc = []
    }
  }
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const h = line.match(/^(#{1,6})\s+(.*)$/)
    if (h) {
      flush()
      blocks.push({ kind: 'heading', level: h[1].length, text: clean(h[2]) })
      i++
      continue
    }
    if (line.trim().startsWith('|')) {
      flush()
      const tableLines: string[] = [line]
      i++
      while (i < lines.length && (lines[i].trim().startsWith('|') || (lines[i].trim() !== '' && !lines[i].startsWith('#')))) {
        if (lines[i].trim().startsWith('|')) { tableLines.push(lines[i]) } else break
        i++
      }
      const dataLines = tableLines.filter((l) => !isSep(l))
      const header = dataLines.length ? splitRow(dataLines[0]) : []
      const rows = dataLines.slice(1).map(splitRow)
      blocks.push({ kind: 'table', header, rows, raw: tableLines.join('\n') })
      continue
    }
    acc.push(line)
    i++
  }
  flush()
  return blocks
}

function barColor(v: number): string {
  if (v >= 70) return 'bg-green-500'
  if (v >= 50) return 'bg-yellow-500'
  return 'bg-red-500'
}

function priorityCls(p: string): string {
  const t = p.toLowerCase()
  if (t.includes('high') || t.includes('高')) return 'bg-red-100 text-red-700'
  if (t.includes('medium') || t.includes('中')) return 'bg-amber-100 text-amber-700'
  if (t.includes('low') || t.includes('低')) return 'bg-green-100 text-green-700'
  return 'bg-gray-100 text-gray-600'
}

function isScoreTable(header: string[]): boolean {
  return /得分|分数/.test(header.join(' '))
}

function TableBlock({ header, rows }: { header: string[]; rows: string[][] }) {
  if (isScoreTable(header)) {
    return (
      <div className="mb-5 mt-2 space-y-3">
        {rows.map((r, i) => {
          const label = clean(r[0] ?? '')
          const numRaw = r.find((c) => !Number.isNaN(parseFloat(c)))
          const num = Math.min(100, Math.max(0, Math.round(parseFloat(numRaw ?? '0') || 0)))
          const extra = r.length > 2 ? clean(r[2]) : ''
          return (
            <div key={i}>
              <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                <span className="text-gray-700">{label}</span>
                <span className="flex shrink-0 items-center gap-2">
                  {extra && (
                    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${priorityCls(extra)}`}>
                      {extra}
                    </span>
                  )}
                  <span className="w-8 text-right font-semibold text-gray-900">{num}</span>
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                <div className={`h-full rounded-full ${barColor(num)}`} style={{ width: `${num}%` }} />
              </div>
            </div>
          )
        })}
      </div>
    )
  }
  return (
    <div className="markdown-body my-3 overflow-x-auto">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{['| ' + header.join(' | ') + ' |', ...rows.map((r) => '| ' + r.join(' | ') + ' |')].join('\n')}</ReactMarkdown>
    </div>
  )
}

export function RichMarkdown({ markdown }: { markdown: string }) {
  const blocks = parseBlocks(markdown)
  return (
    <div className="space-y-2">
      {blocks.map((b, i) => {
        if (b.kind === 'heading') {
          if (b.level === 1) return null
          return (
            <div key={i} className="mb-2 mt-6 flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-sm bg-brand-500" />
              <h3 className="text-[15px] font-semibold text-gray-900">{b.text}</h3>
            </div>
          )
        }
        if (b.kind === 'table') {
          return <TableBlock key={i} header={b.header} rows={b.rows} />
        }
        return (
          <div key={i} className="markdown-body">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{b.text}</ReactMarkdown>
          </div>
        )
      })}
    </div>
  )
}