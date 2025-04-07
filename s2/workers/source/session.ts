import adjustURL from 'util/adjustURL';

import type { Analytics, StyleDefinition } from 'style/style.spec';

// an API key enables the user to construct a session token
// a session token lasts 10 minutes and allows the user to make requests for data

/**
 *
 */
interface SessionKey {
  apiKey?: string;
  token?: string;
  exp?: number;
}

/**
 *
 */
interface SessionResponse {
  token: string;
  maxAge: number;
}

/**
 *
 */
export default class Session {
  analytics?: Analytics;
  sessionKeys: Record<string, SessionKey> = {}; // [mapID]: session
  workers: Array<MessageChannel['port2']> = [];
  currWorker = 0;
  totalWorkers = 0;
  sessionPromise?: Promise<SessionKey | undefined>;

  /**
   * @param mapID
   * @param analytics
   * @param apiKey
   */
  loadStyle(mapID: string, analytics: Analytics, apiKey?: string): void {
    this.analytics = analytics;
    this.sessionKeys[mapID] = { apiKey };
  }

  /**
   * @param _messagePort
   * @param postPort
   * @param id
   */
  loadWorker(
    _messagePort: MessageChannel['port1'],
    postPort: MessageChannel['port2'],
    id: number,
  ): void {
    this.totalWorkers++;
    this.workers[id] = postPort;
  }

  /**
   *
   */
  requestWorker(): MessagePort {
    const worker = this.workers[this.currWorker];
    this.currWorker++;
    if (this.currWorker >= this.totalWorkers) this.currWorker = 0;

    return worker;
  }

  /**
   * @param mapID
   */
  hasAPIKey(mapID: string): boolean {
    return this.sessionKeys[mapID]?.apiKey !== undefined;
  }

  /**
   * @param mapID
   * @param style
   * @param urlMap
   */
  async requestStyle(mapID: string, style: string, urlMap?: Record<string, string>): Promise<void> {
    // grab the auth token
    const Authorization = await this.requestSessionToken(mapID);
    if (Authorization === undefined) return;
    // fetch the style
    const json = await fetch(adjustURL(style, urlMap), { headers: { Authorization } })
      .then<StyleDefinition | null>(async (res) => {
        if (res.status !== 200) return null;
        return await res.json();
      })
      .catch<null>((err) => {
        console.error(err);
        return null;
      });
    // send style back to map
    if (json !== null) postMessage({ type: 'setStyle', mapID, style: json, ignorePosition: false });
  }

  /**
   * @param mapID
   */
  async requestSessionToken(mapID: string): Promise<string | undefined | 'failed'> {
    const failed = 'failed';
    const mapSessionKey = this.sessionKeys[mapID];
    // if there is no apiKey, then the map doesn't requre a session token
    if (mapSessionKey === undefined) return undefined;
    // check if the token is already fresh
    const { apiKey, token, exp } = mapSessionKey;
    if (apiKey === undefined) return failed;
    if (exp !== undefined && token !== undefined && exp - new Date().getTime() > 0) return token;
    const { gpu, context, language, width, height } = this.analytics ?? {};
    // grab a new token
    if (this.sessionPromise === undefined) {
      // TODO: use urlMap to adjust the URL
      this.sessionPromise = fetch(adjustURL('apiURL://session'), {
        method: 'POST',
        body: JSON.stringify({ apiKey, gpu, context, language, width, height }),
        headers: { 'Content-Type': 'application/json' },
      })
        .then<SessionResponse | undefined>(async (res) => {
          if (res.status !== 200 && res.status !== 206) return undefined;
          return await res.json();
        })
        .then<SessionKey | undefined>((t) => {
          if (t === undefined) return undefined;
          const expDate = new Date();
          expDate.setSeconds(expDate.getSeconds() + t.maxAge);
          return { token: t.token, exp: expDate.getTime() };
        })
        .catch((err) => {
          console.error(err);
          return undefined;
        });
    }
    const sessionKey = await this.sessionPromise;
    this.sessionPromise = undefined;
    // store the new key, exp, and return the key to use
    if (sessionKey === undefined) return failed;
    mapSessionKey.token = sessionKey.token;
    mapSessionKey.exp = sessionKey.exp;

    return mapSessionKey.token ?? failed;
  }
}
