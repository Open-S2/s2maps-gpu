import VueS2MapGPU from './S2Map.vue';

import type { App } from 'vue';

export { VueS2MapGPU };
export type * from './S2Map.vue';

/**
 * Install the Vue S2MapGPU Component globally
 * @param app - The Vue app instance
 */
export const vueInstall = (app: App): void => {
  // Register the component globally
  app.component('S2MapGPU', VueS2MapGPU);
  // You could also provide global properties or directives here if needed
};
