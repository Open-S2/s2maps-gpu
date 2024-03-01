import Database from 'better-sqlite3'

interface Data {
  name?: string
  err?: string
}

const base36 = (num: string): number => parseInt(num, 36)

export default defineEventHandler(async (event) => {
  const fontName = getRouterParam(event, 'fontName')

  // pull in db
  const db = new Database('./public/glyphs/GLYPHS.sqlite3', { readonly: true })

  // parse the request
  const { type, codes } = getQuery<{ type: 'metadata' | 'glyph', codes?: string }>(event)
  const pieces = codes?.split(',') ?? []
  if (fontName === undefined || Array.isArray(fontName)) {
    db.close()
    setResponseStatus(event, 404)
    return { err: 'Could not parse fontName' }
  }
  const name = fontName.split('.')[0]

  if (type === 'metadata') {
    const metadata = db
      .prepare<string>('SELECT data FROM metadata where name = ?')
      .get(name) as undefined | { data: string }
    if (metadata?.data === undefined) {
      db.close()
      setResponseStatus(event, 404)
      return { err: 'Could not find metadata' }
    }

    db.close()
    setHeader(event, 'Content-Type', 'application/x-protobuf')
    return Buffer.from(metadata.data, 'base64')
  } else if (type === 'glyph') {
    const batchStmt: Array<undefined | { data: string }> = []
    const stmt = db
      .prepare<[string, string]>('SELECT data FROM glyph_multi where name = ? AND code = ?')
    for (const piece of pieces) {
      if (piece.includes('-')) {
        const [from, to] = piece.split('-').map(base36)
        for (let i = from; i <= to; i++) {
          batchStmt.push(stmt.get(name, String(i)) as undefined | { data: string })
        }
      } else {
        // if piece includes a dot, it's a substitution code
        const code = piece.includes('.') ? piece : String(base36(piece))
        batchStmt.push(stmt.get(name, code) as undefined | { data: string })
      }
    }

    db.close()
    setHeader(event, 'Content-Type', 'application/x-protobuf')
    return Buffer.concat(
      batchStmt.map(d => Buffer.from(d?.data ?? '', 'base64'))
    ) as unknown as Data
  }

  db.close()
  setResponseStatus(event, 404)
  return { err: 'bad inputs' }
})
