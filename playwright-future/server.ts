import path from 'node:path'

Bun.serve({
  port: 8080,
  async fetch (req: Request) {
    // console.log('REQUEST', req.url)
    let response: Response
    const url = new URL(req.url)
    if (url.pathname === '/ping') response = new Response('Pong!')
    else response = await getPublicData(req)

    // Add CORS headers to the response
    response.headers.set('Access-Control-Allow-Origin', '*')
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    return response
  }
})

async function getPublicData (req: Request): Promise<Response> {
  const url = new URL(req.url)
  const filePath = path.join(__dirname, '../public', url.pathname)
  // console.log('filePath', filePath)
  const fileData = Bun.file(filePath)
  if (!(await fileData.exists())) return new Response('Not found', { status: 404 })
  return new Response(fileData.stream())
}

console.info('Server running on http://localhost:8080')