import path from 'path';

const server = Bun.serve({
  port: 3030,
  /**
   * Fetch the appropriate file
   * @param req - the request
   * @returns pong response
   */
  async fetch(req: Request) {
    let response: Response;
    const url = new URL(req.url);
    if (url.pathname === '/ping' || url.pathname === '/') response = new Response('Pong!');
    else response = await getPublicData(req);

    // Add CORS headers to the response
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    return response;
  },
});

/**
 * Get public data
 * @param req - the request
 * @returns the response
 */
async function getPublicData(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const filePath = path.join(__dirname, '../public', url.pathname);
  console.info('filePath', filePath);
  const fileData = Bun.file(filePath);
  if (!(await fileData.exists())) return new Response('Not found', { status: 404 });
  return new Response(fileData.stream());
}

console.info('Server running on http://localhost:3030');

process.once('SIGTERM', async () => {
  console.log('Gracefully shutting down...');
  await server.stop();
  process.exit(0);
});

process.once('SIGINT', async () => {
  console.log('Interrupted, cleaning up...');
  await server.stop();
  process.exit(0);
});
