import { GlobalRegistrator } from '@happy-dom/global-registrator';

GlobalRegistrator.register({
  settings: {
    navigator: {
      // @ts-expect-error - I just want to insert the language. Happy DOM's types are wrong
      language: 'en-US',
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
    },
  },
});
