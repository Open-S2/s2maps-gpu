import type { App } from 'vue';
import S2MapComponent from './S2Map.vue';

/**
 * Define the install function
 * @param app - The Vue app instance
 */
const install = (app: App): void => {
  // Register the component globally
  app.component('S2MapGPU', S2MapComponent);
  // You could also provide global properties or directives here if needed
};

// Export the install function for `app.use()`
// Also export the component itself if users want to import and register it locally
export { install, S2MapComponent };

// Default export for convenience
export default { install };
