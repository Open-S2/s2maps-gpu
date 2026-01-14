// import { adjustURL } from 'util/index.js';

// import type { UrlMap } from 'util/index.js';
// import type { Analytics, StyleDefinition } from 'style/style.spec.js';

// an API key enables the user to construct a session token
// a session token lasts 10 minutes and allows the user to make requests for data

use crate::{
    style::S2MapsAnalytics,
    util::{MsgSender, UrlMap},
    workers::{MapID, TileWorkerMessage},
};
use alloc::collections::BTreeMap;

/** A Session manager object */
#[derive(Debug, Default, Clone, PartialEq)]
pub struct SessionKey {
    /// The API key for the session
    pub api_key: Option<String>,
    /// The session token
    pub token: Option<String>,
    /// The expiration date of the token
    pub exp: Option<f64>,
}
/** A Session response object */
#[derive(Debug, Default, Clone, PartialEq)]
pub struct SessionResponse {
    /// The session token to use
    pub token: String,
    /// The maximum age of the token
    pub max_age: usize,
}

/**
 * Session Manager
 *
 * Keep up to date with API keys and session tokens
 */
#[derive(Debug, Default, Clone)]
pub struct Session {
    /// The analyitics if needed
    pub analytics: Option<S2MapsAnalytics>,
    /// [map_id]: session
    pub session_keys: BTreeMap<MapID, SessionKey>, // = {}; // [map_id]: session
    //   pub workers: Vec<MessageChannel>, //  Array<MessageChannel['port2']> = [];
    /// List of Workers to send messages to. Spread out work via round-robin/load balancing
    pub workers: Vec<MsgSender<TileWorkerMessage>>,
    /// The current worker's ID (index)
    pub curr_worker: usize, // = 0;
    /// The total number of workers
    pub total_workers: usize, // = 0;
                              //   pub session_promise?: Promise<SessionKey | undefined>;
}
impl Session {
    /**
     * Load a style via a URL, sending off analytics and utilizing the api_key if needed
     * @param map_id - the id of the map
     * @param analytics - basic analytics about the GPU and screen dimensions
     * @param api_key - the api key if needed
     */
    pub fn load_style(
        &mut self,
        map_id: MapID,
        analytics: Option<S2MapsAnalytics>,
        api_key: Option<String>,
    ) {
        self.analytics = analytics;
        self.session_keys.insert(map_id, SessionKey { api_key, ..Default::default() });
    }

    /**
     * Load a worker
     * @param _messagePort - unused
     * @param postPort - the port for a worker to send session messages to
     * @param id - the id of the worker
     */
    pub fn load_worker(&mut self, worker: MsgSender<TileWorkerMessage>, id: usize) {
        self.total_workers += 1;
        // resize if needed
        if self.workers.len() <= id {
            self.workers.resize(id + 1, worker.clone());
        } else {
            self.workers[id] = worker;
        }
    }

    /// Request a worker to process data
    ///
    /// ## Returns
    /// the communication port for the worker
    pub fn request_worker(&mut self) -> &MsgSender<TileWorkerMessage> {
        let worker = &self.workers[self.curr_worker];
        self.curr_worker += 1;
        if self.curr_worker >= self.total_workers {
            self.curr_worker = 0;
        }

        worker
    }

    /// Check if the map has an API key
    ///
    /// ## Parameters
    /// - `map_id`: the id of the map
    ///
    /// ## Returns
    /// true if the map has an API key
    pub fn has_api_key(&self, map_id: &MapID) -> bool {
        self.session_keys.get(map_id).and_then(|m| Some(m.api_key.is_some())).unwrap_or(false)
    }

    /**
     * Request a style from the server
     * @param map_id - the id of the map
     * @param style - the style url
     * @param url_map - the url map to properly modify and resolve urls
     */
    pub async fn request_style(map_id: MapID, style: String, url_map: Option<UrlMap>) {
        //     // grab the auth token
        //     const Authorization = await this.request_session_token(map_id);
        //     if (Authorization === undefined) return;
        //     // fetch the style
        //     const json = await fetch(adjust_url(style, url_map), { headers: { Authorization } })
        //       .then<StyleDefinition | null>(async (res) => {
        //         if (res.status !== 200) return null;
        //         return await res.json();
        //       })
        //       .catch<null>((err) => {
        //         console.error(err);
        //         return null;
        //       });
        //     // send style back to map
        //     if (json !== null) postMessage({ type: 'setStyle', map_id, style: json, ignorePosition: false });
        todo!()
    }

    /**
     * Request a session token from the server to start fetching data
     * @param map_id - the id of the map
     * @returns the session token if available and/or successful
     */
    pub async fn request_session_token(map_id: MapID) -> Option<String> {
        //     const failed = 'failed';
        //     const mapSessionKey = this.session_keys[map_id];
        //     // if there is no api_key, then the map doesn't requre a session token
        //     if (mapSessionKey === undefined) return undefined;
        //     // check if the token is already fresh
        //     const { api_key, token, exp } = mapSessionKey;
        //     if (api_key === undefined) return failed;
        //     if (exp !== undefined && token !== undefined && exp - new Date().getTime() > 0) return token;
        //     const { gpu, context, language, width, height } = this.analytics ?? {};
        //     // grab a new token
        //     if (this.session_promise === undefined) {
        //       // TODO: use urlMap to adjust the URL
        //       this.session_promise = fetch(adjustURL('apiURL://session'), {
        //         method: 'POST',
        //         body: JSON.stringify({ api_key, gpu, context, language, width, height }),
        //         headers: { 'Content-Type': 'application/json' },
        //       })
        //         .then<SessionResponse | undefined>(async (res) => {
        //           if (res.status !== 200 && res.status !== 206) return undefined;
        //           return await res.json();
        //         })
        //         .then<SessionKey | undefined>((t) => {
        //           if (t === undefined) return undefined;
        //           const expDate = new Date();
        //           expDate.setSeconds(expDate.getSeconds() + t.max_age);
        //           return { token: t.token, exp: expDate.getTime() };
        //         })
        //         .catch((err) => {
        //           console.error(err);
        //           return undefined;
        //         });
        //     }
        //     const sessionKey = await this.session_promise;
        //     this.session_promise = undefined;
        //     // store the new key, exp, and return the key to use
        //     if (sessionKey === undefined) return failed;
        //     mapSessionKey.token = sessionKey.token;
        //     mapSessionKey.exp = sessionKey.exp;

        //     return mapSessionKey.token ?? failed;
        todo!()
    }
}
