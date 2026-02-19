#[cfg(feature = "std")]
use embassy_sync::blocking_mutex::raw::NoopRawMutex;
#[cfg(feature = "embassy")]
use embassy_sync::blocking_mutex::raw::ThreadModeRawMutex;
use embassy_sync::signal::Signal;

/// A cross-platform Promise-like synchronization primitive.
/// In Embassy/no_std, we use ThreadModeRawMutex (safe for single-core interrupts).
/// In std, we use NoopRawMutex if we are staying within a single-threaded executor.
/// If we need multi-threaded safety, we can move to CriticalSectionRawMutex.
pub struct Promise {
    #[cfg(feature = "embassy")]
    inner: Signal<ThreadModeRawMutex, ()>,

    #[cfg(feature = "std")]
    inner: Signal<NoopRawMutex, ()>,
}
impl alloc::fmt::Debug for Promise {
    fn fmt(&self, f: &mut alloc::fmt::Formatter<'_>) -> alloc::fmt::Result {
        f.debug_struct("Promise").finish()
    }
}
impl Promise {
    /// Create a new Promise
    pub const fn new() -> Self {
        Self { inner: Signal::new() }
    }
    /// Maps to `this.resolve()` in the TS class
    pub fn resolve(&self) {
        self.inner.signal(());
    }
    /// Map to `await this.ready`
    pub async fn wait(&self) {
        self.inner.wait().await;
    }
    /// Check if it's already resolved without yielding
    pub fn is_completed(&self) -> bool {
        self.inner.signaled()
    }
}
