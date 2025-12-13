import fs from 'node:fs/promises'
import path from 'node:path'
import postcss from 'postcss'

function splitSelectorList(selectorText) {
  const parts = []
  let current = ''
  let parenDepth = 0
  let bracketDepth = 0
  let inString = false
  let stringQuote = ''

  for (let i = 0; i < selectorText.length; i += 1) {
    const ch = selectorText[i]

    if (inString) {
      current += ch
      if (ch === stringQuote && selectorText[i - 1] !== '\\') {
        inString = false
        stringQuote = ''
      }
      continue
    }

    if (ch === '"' || ch === "'") {
      inString = true
      stringQuote = ch
      current += ch
      continue
    }

    if (ch === '(') parenDepth += 1
    if (ch === ')') parenDepth = Math.max(0, parenDepth - 1)
    if (ch === '[') bracketDepth += 1
    if (ch === ']') bracketDepth = Math.max(0, bracketDepth - 1)

    if (ch === ',' && parenDepth === 0 && bracketDepth === 0) {
      parts.push(current.trim())
      current = ''
      continue
    }

    current += ch
  }

  if (current.trim()) parts.push(current.trim())
  return parts
}

function isInsideKeyframes(rule) {
  let parent = rule.parent
  while (parent) {
    if (parent.type === 'atrule') {
      const name = String(parent.name || '')
      if (name === 'keyframes' || name.endsWith('keyframes')) return true
    }
    parent = parent.parent
  }
  return false
}

async function scopeCssFile(filePath, scopeSelector) {
  const absPath = path.resolve(filePath)
  const css = await fs.readFile(absPath, 'utf8')
  const root = postcss.parse(css, { from: absPath })

  root.walkRules((rule) => {
    if (!rule.selector) return
    if (isInsideKeyframes(rule)) return

    const selectors = splitSelectorList(rule.selector)
    rule.selector = selectors.map((s) => `${scopeSelector} ${s}`).join(', ')
  })

  await fs.writeFile(absPath, root.toResult().css, 'utf8')
}

const [, , filePath, scopeSelector] = process.argv
if (!filePath || !scopeSelector) {
  console.error('Usage: node scripts/scope-css.mjs <file> <scopeSelector>')
  process.exit(1)
}

await scopeCssFile(filePath, scopeSelector)

