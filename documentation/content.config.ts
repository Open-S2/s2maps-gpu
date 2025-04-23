import { defineCollection, defineContentConfig, z } from '@nuxt/content';

export default defineContentConfig({
  collections: {
    examples: defineCollection({
      type: 'page',
      source: 'examples/*.md',
      // Define custom schema for examples collection
      schema: z.object({
        title: z.string(),
        description: z.string(),
        navigation: z.boolean().optional(),
        cover: z.object({
          image: z.string(),
          alt: z.string(),
          caption: z.string(),
          addBorder: z.boolean().optional(),
        }),
        icon: z.string(),
        date: z.date(),
        keywords: z.array(z.string()),
      }),
    }),
  },
});
