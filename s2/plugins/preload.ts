/**
 * Define how we want to build the map
 * - 'preloaded': the map is already loaded into the window object
 * - 'flat': Pull in the flat build (useful for development and testing)
 * - 'prod': Pull in the production build. It has seperate calls for workers
 */
export type BuildType = 'preloaded' | 'flat' | 'prod';

// Keep track of the assets that have been preloaded. Sometimes mulitple maps will be loaded in a single page
const preloadedAssets = new Set<string>();

/**
 * Preload the map and associated CSS
 * @param build - the build type
 * @param version - the version
 */
export async function preloadMap(build: BuildType, version: string = 'latest'): Promise<void> {
  if (build === 'preloaded') return;
  const fullVersion = version === 'latest' ? 'latest' : `v${version}`;
  let startPath = `https://opens2.com/s2maps-gpu/${fullVersion}`;
  if (build === 'flat') startPath += '-flat';
  const styleUrl = `${startPath}/s2maps-gpu.min.css`;
  const scriptUrl =
    build === 'flat' ? `${startPath}/s2maps-gpu.flat.js` : `${startPath}/s2maps-gpu.min.js`;
  // handle replaoding the CSS
  if (!preloadedAssets.has(styleUrl)) {
    preloadedAssets.add(styleUrl);
    preloadStyle(styleUrl);
  }
  // handle reloading the script
  if (!preloadedAssets.has(scriptUrl)) {
    preloadedAssets.add(scriptUrl);
    await preloadScript(scriptUrl);
  }
}

/**
 * Preload a script
 * @param url - the url of the script to load
 * @returns a promise that resolves when the script is loaded
 */
export async function preloadScript(url: string): Promise<void> {
  return await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.async = true;
    document.head.appendChild(script);
    /** Load the script; resolve the promise when complete */
    script.onload = () => {
      resolve();
    };
    /**
     * Handle errors
     * @param err - the error
     */
    script.onerror = (err: string | Event): void => {
      const errorMessage = typeof err === 'string' ? err : 'Failed to load script';
      console.error(`Error loading s2maps-gpu from ${url}`, errorMessage);
      reject(new Error(`Failed to load script: ${url}`));
    };
  });
}

/**
 * Preload a style. Be sure we haven't already loaded it
 * @param url - the url
 */
export function preloadStyle(url: string): void {
  if (document.querySelector(`link[href="${url}"]`) === null) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.type = 'text/css';
    link.href = url;
    document.head.appendChild(link);
  }
}
