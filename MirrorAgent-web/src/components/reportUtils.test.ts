import { describe, expect, it } from 'vitest'
import { extractReportHeader } from './reportUtils'

describe('extractReportHeader', () => {
  it('提取摘要字段并保留正文', () => {
    const result = extractReportHeader([
      '# 面试评估报告',
      '**综合评分**：85',
      '**岗位匹配**：高',
      '',
      '## 详细分析',
      '表现稳定。',
    ].join('\n'))

    expect(result.items).toEqual([
      { label: '综合评分', value: '85' },
      { label: '岗位匹配', value: '高' },
    ])
    expect(result.rest).toContain('## 详细分析')
  })

  it('没有合法摘要时保留原文', () => {
    const markdown = '## 开始\n这是一段普通报告。'
    const result = extractReportHeader(markdown)

    expect(result.items).toEqual([])
    expect(result.rest).toBe('这是一段普通报告。')
  })
})