// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import Database from 'better-sqlite3'

import type { NextApiRequest, NextApiResponse } from 'next'

interface Data {
  name?: string
  err?: string
}

const base36 = (num: string): number => parseInt(num, 36)

export default function handler (
  req: NextApiRequest,
  res: NextApiResponse<Data | Buffer>
): void {
  // pull in db
  const db = new Database('./public/glyphs/GLYPHS_V2.sqlite', { readonly: true })

  // parse the request
  const { query: { fontName }, url } = req
  const { searchParams } = new URL(url ?? '', 'http://localhost')
  const pieces = searchParams.get('codes')?.split(',') ?? []
  const type = searchParams.get('type') ?? 'glyph'
  if (fontName === undefined || Array.isArray(fontName)) {
    res.status(404).json({ err: 'Could not parse fontName' })
    return
  }
  const name = fontName.split('.')[0]

  if (type === 'metadata') {
    const metadata = db
      .prepare<string>('SELECT data FROM metadata where name = ?')
      .get(name) as undefined | { data: string }
    if (metadata?.data === undefined) {
      res.status(404).json({ err: 'Could not find metadata' })
      return
    }

    res
      .status(200)
      .setHeader('Content-Type', 'application/x-protobuf')
      .send(Buffer.from(metadata.data, 'base64'))
    return
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

    res
      .status(200)
      .setHeader('Content-Type', 'application/x-protobuf')
      .send(Buffer.concat(
        batchStmt.map(d => Buffer.from(d?.data ?? '', 'base64'))
      ) as unknown as Data)

    db.close()
    return
  }

  res.status(404).json({ err: 'bad inputs' })
}
