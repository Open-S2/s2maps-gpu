use alloc::{
    string::{String, ToString},
    vec::Vec,
};
use serde::Serialize;

/// Net fetch error
#[derive(Debug, Clone, PartialEq)]
pub enum NetError {
    /// Network error
    Network(String),
    /// HTTP error
    Http(u16),
    /// Other
    Other(String),
}
impl From<NetError> for () {
    fn from(_e: NetError) -> Self {}
}

/// HTTP Method (Basic)
#[derive(Debug, Default, Clone, Copy, PartialEq)]
pub enum Method {
    /// GET
    #[default]
    Get,
    /// POST
    Post,
    /// PUT
    Put,
    /// DELETE
    Delete,
    /// HEAD
    Head,
    /// OPTIONS
    Options,
}
#[cfg(feature = "std")]
impl From<Method> for surf::http::Method {
    fn from(m: Method) -> surf::http::Method {
        match m {
            Method::Get => surf::http::Method::Get,
            Method::Post => surf::http::Method::Post,
            Method::Put => surf::http::Method::Put,
            Method::Delete => surf::http::Method::Delete,
            Method::Head => surf::http::Method::Head,
            Method::Options => surf::http::Method::Options,
        }
    }
}

// TODO: Embassy case doesn't work for sure.

/// No-std embassy fetch for raw data (HTTP only)
/// headers are ignored in this simple version
#[cfg(feature = "embassy")]
pub async fn fetch_url(
    stack: &embassy_net::Stack,
    host: &str,
    path: &str,
    _headers: &[(&str, &str)],
) -> Result<Vec<u8>, NetError> {
    let mut socket = TcpSocket::new();
    socket.connect(stack, (host, 80)).await.map_err(|e| NetError::Network(e.to_string()))?;

    let request = format!("GET {} HTTP/1.1\r\nHost: {}\r\nConnection: close\r\n\r\n", path, host);

    socket.write_all(request.as_bytes()).await.map_err(|e| NetError::Network(e.to_string()))?;

    let mut buf = [0u8; 1024];
    let mut response = Vec::new();

    loop {
        let n = socket.read(&mut buf).await.map_err(|e| NetError::Network(e.to_string()))?;
        if n == 0 {
            break;
        }
        response.extend_from_slice(&buf[..n]);
    }

    // Very simple: strip HTTP headers
    let body_start = response
        .windows(4)
        .position(|w| w == b"\r\n\r\n")
        .map(|p| p + 4)
        .ok_or_else(|| NetError::Other("Malformed HTTP response".into()))?;

    Ok(response[body_start..].to_vec())
}

/// STD and/or WASM fetch with arbitrary HTTP method and optional JSON body
/// Example:
/// ```ignore
/// fetch_url("http://example.com/api", &[("header","value")], Some(Method::Post), Some(&my_struct)).await
/// ```
#[cfg(feature = "std")]
pub async fn fetch_url<T: Serialize>(
    url: &str,
    headers: &[(&str, &str)],
    method: Option<Method>,
    body: Option<&T>,
) -> Result<Vec<u8>, NetError> {
    let method = method.unwrap_or_default();
    let client = surf::client();
    let url = url.parse::<surf::Url>().map_err(|e| NetError::Other(e.to_string()))?;
    let mut req = surf::Request::new(method.into(), url);

    // Add headers
    for (k, v) in headers {
        req.set_header(*k, *v);
    }
    // Add JSON body if provided
    if let Some(b) = body {
        let json_str = serde_json::to_string(b).map_err(|e| NetError::Other(e.to_string()))?;
        req.set_body(surf::Body::from(json_str));
        req.set_content_type("application/json".into());
    }
    // Send request
    let mut res = client.send(req).await.map_err(|e| NetError::Network(e.to_string()))?;

    if !res.status().is_success() {
        return Err(NetError::Http(res.status().into()));
    }

    res.body_bytes().await.map_err(|e| NetError::Other(e.to_string()))
}
