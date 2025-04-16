import { BunPlugin } from 'bun';
import { optimize } from 'svgo';

import type { OnLoadArgs, OnLoadResult, PluginBuilder } from 'bun';

const SvgPlugin: BunPlugin = {
  name: 'svg-loader',
  /**
   * Setup plugin
   * @param build - plugin build
   */
  setup(build: PluginBuilder): void {
    build.onLoad({ filter: /\.svg$/ }, async (args: OnLoadArgs): Promise<OnLoadResult> => {
      // read the SVG file
      const text = await Bun.file(args.path).text();

      const result = optimize(text, {
        path: args.path,
        multipass: true,
      });

      return {
        contents: result.data,
        loader: 'text', // This will convert to base64
      };
    });
  },
};

export default SvgPlugin;
