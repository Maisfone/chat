#!/usr/bin/env node
// Normalize common mojibake in source files and ensure UTF-8 + LF
const fs = require('fs')
const path = require('path')

const roots = ['client', 'server']
const allowed = new Set(['.js', '.jsx', '.ts', '.tsx', '.css', '.html', '.md'])

const map = [
  // Dashes, quotes, bullets
  ['â€“', '–'], ['â€”', '—'], ['â€œ', '“'], ['â€', '”'], ['â€˜', '‘'], ['â€™', '’'], ['â€¢', '•'],
  // Accented letters (utf8 seen as latin1)
  ['Ã¡', 'á'], ['Ã©', 'é'], ['Ã­', 'í'], ['Ã³', 'ó'], ['Ãº', 'ú'], ['Ã§', 'ç'],
  ['Ã£', 'ã'], ['Ãµ', 'õ'], ['Ã¢', 'â'], ['Ãª', 'ê'], ['Ã´', 'ô'],
  ['Ã', 'Á'], ['Ã‰', 'É'], ['ÃŠ', 'Ê'], ['Ã“', 'Ó'], ['Ãš', 'Ú'], ['Ã‡', 'Ç'],
  // Frequent words in pt-BR
  ['Configuracoes', 'Configurações'], ['Permissao', 'Permissão'], ['Endereco', 'Endereço'],
  ['Icone', 'Ícone'], ['icone', 'ícone'], ['Usuarios', 'Usuários'], ['Usuario', 'Usuário']
]

let changed = 0

function fixText(t) {
  let out = t
  for (const [from, to] of map) out = out.split(from).join(to)
  // normalize LF
  out = out.replace(/\r\n/g, '\n')
  return out
}

function processFile(file) {
  const ext = path.extname(file)
  if (!allowed.has(ext)) return
  const raw = fs.readFileSync(file)
  const text = raw.toString('utf8')
  const fixed = fixText(text)
  if (fixed !== text) {
    fs.writeFileSync(file, fixed, { encoding: 'utf8' })
    console.log('Normalized:', file)
    changed++
  }
}

function walk(dir) {
  if (!fs.existsSync(dir)) return
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name)
    const st = fs.statSync(p)
    if (st.isDirectory()) walk(p)
    else processFile(p)
  }
}

roots.forEach(walk)
console.log('Done. Files changed:', changed)

