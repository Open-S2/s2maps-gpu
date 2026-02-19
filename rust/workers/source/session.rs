// an API key enables the user to construct a session token
// a session token lasts 10 minutes and allows the user to make requests for data

use crate::{
    style::{S2MapsAnalytics, StyleDefinition},
    util::{MsgSender, Promise, UrlMap},
    workers::{
        MapID, SourceSetStyleMessage, SourceWorkerMessage, SourceWorkerMessageOutput,
        TileWorkerMessage,
    },
};
use alloc::collections::BTreeMap;
use gistools::util::{Date, fetch_url};
use serde::{Deserialize, Serialize};

/// A Session manager object
#[derive(Debug, Default, Clone, PartialEq)]
pub struct SessionKey {
    /// The API key for the session
    pub api_key: Option<String>,
    /// The session token
    pub token: Option<String>,
    /// The expiration date of the token
    pub exp: Option<f64>,
}
/// A Session response object
#[derive(Debug, Default, Clone, PartialEq, Serialize, Deserialize)]
pub struct SessionResponse {
    /// The session token to use
    pub token: String,
    /// The maximum age of the token
    pub max_age: usize,
}

/// Session Manager
///
/// Keep up to date with API keys and session tokens
#[derive(Debug)]
pub struct Session {
    /// The analyitics if needed
    pub analytics: Option<S2MapsAnalytics>,
    /// [map_id]: session
    pub session_keys: BTreeMap<MapID, SessionKey>,
    /// List of Workers to send messages to. Spread out work via round-robin/load balancing
    pub workers: Vec<MsgSender<TileWorkerMessage>>,
    /// The current worker's ID (index)
    pub curr_worker: usize,
    /// The total number of workers
    pub total_workers: usize,
    /// A promise for the session to avoid multiple requests early on load.
    pub session_promise: Option<Promise>,
    /// A URL MAP
    pub url_map: UrlMap,
    /// The worker pool to ping back to
    pub worker_pool: MsgSender<SourceWorkerMessageOutput>,
}
impl Session {
    /// Create a new session
    pub fn new(worker_pool: MsgSender<SourceWorkerMessageOutput>) -> Self {
        Self {
            analytics: None,
            session_keys: BTreeMap::default(),
            workers: vec![],
            curr_worker: 0,
            total_workers: 0,
            session_promise: None,
            url_map: UrlMap::default(),
            worker_pool,
        }
    }

    /// Load a style via a URL, sending off analytics and utilizing the api_key if needed
    ///
    /// ## Parameters
    /// - `map_id`: the id of the map
    /// - `analytics`: basic analytics about the GPU and screen dimensions
    /// - `api_key`: the api key if needed
    pub fn load_style(
        &mut self,
        map_id: MapID,
        analytics: Option<S2MapsAnalytics>,
        api_key: Option<String>,
    ) {
        self.analytics = analytics;
        self.session_keys.insert(map_id, SessionKey { api_key, ..Default::default() });
    }

    /// Load a worker
    ///
    /// ## Parameter
    /// - `worker`: the message port for a worker to send session messages to
    /// - `id`: the id of the worker
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

    /// Request a style from the server
    ///
    /// ## Parameters
    /// - `map_id`: the id of the map
    /// - `style`: the style url
    /// - `url_map`: the url map to properly modify and resolve urls
    pub async fn request_style(&mut self, map_id: MapID, style: String, url_map: Option<UrlMap>) {
        let url_map = url_map.unwrap_or_default();
        self.url_map = url_map.clone();
        // grab the auth token
        let authorization = self.request_session_token(map_id).await;
        let mut headers: Vec<(&str, &str)> = vec![];
        if authorization.is_some() && authorization != Some("failed".into()) {
            headers.push(("Authorization", authorization.as_ref().unwrap().as_str()));
        }
        // fetch the style
        let json = fetch_url::<()>(&url_map.adjust_url(style), &headers, None, None).await;
        if json.is_err() {
            return;
        }
        // send style back to map
        if let Ok(json) = serde_json::from_slice::<StyleDefinition>(json.as_ref().unwrap()) {
            self.worker_pool
                .send(SourceWorkerMessageOutput {
                    map_id,
                    message: SourceWorkerMessage::SourceSetStyle(SourceSetStyleMessage {
                        style: json,
                        ignore_position: false,
                    }),
                })
                .await;
        }
    }

    /// Request a session token from the server to start fetching data
    ///
    /// ## Parameters
    /// - `map_id`: the id of the map
    ///
    /// ## Returns
    /// The session token if available and/or successful
    pub async fn request_session_token(&mut self, map_id: MapID) -> Option<String> {
        let failed: String = "failed".into();
        let map_session_key = self.session_keys.get_mut(&map_id);
        // if there is no api_key, then the map doesn't requre a session token
        if map_session_key.is_none() {
            return None;
        }
        let map_session_key = map_session_key.unwrap();
        // check if the token is already fresh
        if map_session_key.api_key.is_none() {
            return Some(failed);
        }
        if let Some(exp) = map_session_key.exp
            && let Some(token) = &map_session_key.token
            && (exp - (Date::new(0, 0, 0).get_time() as f64)) > 0.
        {
            return Some(token.clone());
        }
        let mut session_key: Option<SessionKey> = None;
        // grab a new token
        if self.session_promise.is_none() {
            self.session_promise = Some(Promise::new());
            let data = fetch_url(
                &self.url_map.adjust_url("apiURL://session".into()),
                &[],
                None,
                Some(&self.analytics),
            )
            .await;
            if data.is_err() {
                self.session_promise.as_ref().unwrap().resolve();
                self.session_promise = None;
                return Some(failed);
            }
            let data = serde_json::from_slice::<SessionResponse>(data.as_ref().unwrap());
            if data.is_err() {
                self.session_promise.as_ref().unwrap().resolve();
                self.session_promise = None;
                return Some(failed);
            }
            let data = data.unwrap();
            let mut exp_date = Date::new(0, 0, 0);
            exp_date.set_time(exp_date.get_time() + data.max_age as i64);
            session_key = Some(SessionKey {
                api_key: map_session_key.api_key.clone(),
                token: Some(data.token),
                exp: Some(exp_date.get_time() as f64),
            });
            self.session_promise.as_ref().unwrap().resolve();
        }
        self.session_promise.as_ref().unwrap().wait().await;
        self.session_promise = None;
        // store the new key, exp, and return the key to use
        if session_key.is_none() {
            return Some(failed);
        }
        let session_key = session_key.unwrap();
        map_session_key.token = session_key.token;
        map_session_key.exp = session_key.exp;

        Some(map_session_key.token.clone().unwrap_or(failed))
    }
}
