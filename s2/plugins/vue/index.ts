import type { App } from 'vue';
import VueS2MapGPU from './S2Map.vue';

/**
 * Define the install function
 * @param app - The Vue app instance
 */
const vueInstall = (app: App): void => {
  // Register the component globally
  app.component('S2MapGPU', VueS2MapGPU);
  // You could also provide global properties or directives here if needed
};

// Export the install function for `app.use()`
// Also export the component itself if users want to import and register it locally
export { vueInstall, VueS2MapGPU };
