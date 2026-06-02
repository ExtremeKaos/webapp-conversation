'use client'
import { Streamdown } from 'streamdown'
import { code } from '@streamdown/code'
import { math } from '@streamdown/math'
import { mermaid } from '@streamdown/mermaid'
import 'katex/dist/katex.min.css'
import 'streamdown/styles.css'

interface StreamdownMarkdownProps {
  content: string
  className?: string
}

// Reasoning models stream their chain-of-thought wrapped in <think>/<thinking>
// tags. Hide it: remove closed blocks and, while streaming, anything after an
// unclosed opening tag.
const stripThinking = (content: string) => {
  return content
    .replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/g, '')
    .replace(/<think(?:ing)?>[\s\S]*$/, '')
    .trim()
}

// A dashes-only line glued under text is a setext heading in CommonMark and
// turns the previous line into a big H2. LLM/workflow output usually means a
// separator there, so force it to be one by inserting a blank line.
const normalizeSetextDashes = (content: string) => {
  return content.replace(/^(.+)\n(-{3,})\s*$/gm, '$1\n\n$2')
}

export function StreamdownMarkdown({ content, className = '' }: StreamdownMarkdownProps) {
  return (
    <div className={`streamdown-markdown ${className}`}>
      <Streamdown plugins={{ code, math, mermaid }}>{normalizeSetextDashes(stripThinking(content))}</Streamdown>
    </div>
  )
}

export default StreamdownMarkdown
