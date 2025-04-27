import { expect } from 'vitest';

expect.addSnapshotSerializer({
  /**
   * Matches any string
   * @param val - input
   * @returns true if it's a string
   */
  test: (val: unknown): val is string => typeof val === 'string',

  /**
   * Strips absolute prefix up to the project folder
   * @param val - input
   * @returns updated path
   */
  print: (val: unknown) => '"' + (val as string).replace(/^.*\/s2maps-gpu\//, '') + '"',
});

// globalThis.Worker = class MockWorker {
//   #resolve!: () => void;
//   #ready: Promise<void>;
//   #workerContext: any = {};

//   /**
//    * @param scriptUrl
//    * @param _options
//    */
//   constructor(scriptUrl: URL, _options: WorkerOptions) {
//     this.#ready = new Promise((resolve) => {
//       this.#resolve = resolve;
//     });

//     void fetch(scriptUrl)
//       .then(async (res) => await res.text())
//       .then(async (source) => {
//         const blob = new Blob([source], { type: 'text/javascript' });

//         const blobUrl = URL.createObjectURL(blob);
//         const module = await import(/* @vite-ignore */ blobUrl);
//         URL.revokeObjectURL(blobUrl);
//         return module;
//       })
//       .then((module) => {
//         this.#workerContext = new module.default();
//         this.#resolve();
//       })
//       .catch((err) => {
//         console.error(err);
//       });
//   }

//   /**
//    * @param msg
//    */
//   async postMessage(msg: any) {
//     // console.log('HERHEHREHRHER - postMessage', msg);
//     await this.#ready;
//     this.#workerContext.onmessage?.(msg);
//   }

//   /**
//    * @param msg
//    */
//   async onMessage(msg: any) {
//     // console.log('HERHEHREHRHER - onMessage', msg);
//     await this.#ready;
//     this.#workerContext.onmessage?.(msg);
//   }

//   /**
//    *
//    */
//   terminate() {
//     // No-op
//   }
// };
