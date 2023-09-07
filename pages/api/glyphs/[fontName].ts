// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import Database from 'better-sqlite3'

import type { NextApiRequest, NextApiResponse } from 'next'

interface Data {
  name: string
}

const base36 = (num: string): number => parseInt(num, 36)

export default function handler (
  req: NextApiRequest,
  res: NextApiResponse<Data>
): void {
  // pull in db
  const db = new Database('./public/glyphs/GLYPHS.sqlite3', { readonly: true })

  // parse the request
  const { query: { fontName }, url } = req
  const { pathname, searchParams } = new URL(url ?? '', 'http://localhost')
  const pieces = searchParams.get('codes')?.split(',') ?? []
  const type = searchParams.get('type') ?? 'glyph'
  const name = fontName.split('.')[0]

  if (type === 'metadata') {
    const metadata = db.prepare<{ data: Buffer }>('SELECT data FROM metadata where name = ?').get(name)
    if (metadata === undefined || metadata.data === undefined) return res.status(404).json({ err: 'Could not find' })

    return res
      .status(200)
      .setHeader('Content-Type', 'application/x-protobuf')
      .send(metadata.data as Data)
  } else if (type === 'glyph') {
    const batchStmt = []
    const stmt = db.prepare<{ data: Buffer }>('SELECT data FROM glyph_multi where name = ? AND code = ?')
    for (const piece of pieces) {
      if (piece.includes('-')) {
        const [from, to] = piece.split('-').map(base36)
        for (let i = from; i <= to; i++) batchStmt.push(stmt.get(name, i))
      } else {
        batchStmt.push(stmt.get(name, base36(piece)))
      }
    }

    return res
      .status(200)
      .setHeader('Content-Type', 'application/x-protobuf')
      .send(Buffer.concat(batchStmt.map(d => d.data)) as Data)
  }

  res.status(404).json({ name: 'John Doe' })
}
