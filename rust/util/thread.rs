#[cfg(any(target_arch = "wasm32", feature = "wasm"))]
use async_channel::{Receiver, Sender, unbounded};
#[cfg(feature = "embassy")]
use embassy_sync::channel::Channel;
#[cfg(feature = "std")]
use std::sync::mpsc::{Receiver, Sender, channel};

/// Unified sender type
#[derive(Debug)]
pub struct MsgSender<T> {
    #[cfg(feature = "std")]
    tx: Sender<T>,
    #[cfg(any(target_arch = "wasm32", feature = "wasm"))]
    tx: Sender<T>,
    #[cfg(feature = "embassy")]
    tx: &'static Channel<'static, T, 16>,
}
impl<T> Clone for MsgSender<T> {
    fn clone(&self) -> Self {
        #[cfg(feature = "std")]
        return Self { tx: self.tx.clone() };
        #[cfg(any(target_arch = "wasm32", feature = "wasm"))]
        return Self { tx: self.tx.clone() };
        #[cfg(feature = "embassy")]
        return Self { tx: self.tx }; // just copy reference
    }
}
impl<T> MsgSender<T> {
    /// Send a message to the main receiver
    pub async fn send(&self, msg: T) {
        #[cfg(feature = "std")]
        {
            let _ = self.tx.send(msg);
        }
        #[cfg(any(target_arch = "wasm32", feature = "wasm"))]
        {
            let _ = self.tx.send(msg).await;
        }
        #[cfg(feature = "embassy")]
        {
            self.tx.send(msg).await;
        }
    }
}

/// Unified receiver type
#[derive(Debug)]
pub struct MsgReceiver<T> {
    #[cfg(feature = "std")]
    rx: Receiver<T>,
    #[cfg(any(target_arch = "wasm32", feature = "wasm"))]
    rx: Receiver<T>,
    #[cfg(feature = "embassy")]
    rx: &'static Channel<'static, T, 16>,
}
impl<T> MsgReceiver<T> {
    /// Receive a message from the sender
    pub async fn recv(&mut self) -> T {
        #[cfg(feature = "std")]
        {
            self.rx.recv().unwrap()
        }
        #[cfg(any(target_arch = "wasm32", feature = "wasm"))]
        {
            self.rx.recv().await.unwrap()
        }
        #[cfg(feature = "embassy")]
        {
            self.rx.recv().await
        }
    }
}
/// Create a new channel
pub fn new_channel<T>() -> (MsgSender<T>, MsgReceiver<T>) {
    #[cfg(feature = "std")]
    {
        let (tx, rx) = channel();
        (MsgSender { tx }, MsgReceiver { rx })
    }
    #[cfg(any(target_arch = "wasm32", feature = "wasm"))]
    {
        let (tx, rx) = unbounded();
        (MsgSender { tx }, MsgReceiver { rx })
    }
    #[cfg(feature = "embassy")]
    {
        static CHANNEL: Channel<'static, T, 16> = Channel::new();
        (&MsgSender { tx: &CHANNEL }, &MsgReceiver { rx: &CHANNEL })
    }
}

/// Get the number of available threads
pub fn available_parallelism() -> usize {
    #[cfg(feature = "std")]
    return std::thread::available_parallelism().map(|n| n.get()).unwrap_or(1);
    #[cfg(not(feature = "std"))]
    return 1;
}
