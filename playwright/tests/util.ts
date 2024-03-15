import type { S2Map } from 's2'

export async function waitMap (): Promise<void> {
  const s2Map: S2Map = window.testMap
  await new Promise<void>((resolve) => {
    s2Map.addEventListener('ready', async (): Promise<void> => {
      await s2Map.awaitFullyRendered()
      resolve()
    }, { once: true })
  })
}
