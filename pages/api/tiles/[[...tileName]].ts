// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import fs from 'fs'
import { brotliDecompressSync } from 'zlib'

import type { NextApiRequest, NextApiResponse } from 'next'

interface Error {
  err?: string
}

// http://localhost:3000/api/tiles/s2/streets/metadata.json
// http://localhost:3000/api/tiles/s2/streets/2/0/0/0.pbf
export default function handler (
  req: NextApiRequest,
  res: NextApiResponse<Buffer | Error>
): void {
  // parse the request
  const { query: { tileName } } = req
  if (tileName === undefined) {
    res.status(404).json({ err: 'Could not parse fontName' })
    return
  }
  const name = Array.isArray(tileName) ? tileName.join('/') : tileName

  const file = `./public/tiles/${name}`
  if (!fs.existsSync(file)) {
    res.status(404).json({ err: 'bad inputs' })
    return
  }

  let data = fs.readFileSync(file)

  // set appropriate headers
  if (file.includes('metadata')) {
    res.setHeader('Content-Type', 'application/json')
  } else {
    res.setHeader('Content-Type', 'application/x-protobuf')
    data = brotliDecompressSync(data)
  }

  res
    .status(200)
    .send(data)
}
