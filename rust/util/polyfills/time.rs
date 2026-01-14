#[cfg(feature = "embassy")]
pub use embassy_time::Instant;
#[cfg(feature = "std")]
pub use std::time::Instant;

/// Dummy Instant for now
#[cfg(all(not(feature = "std"), not(feature = "embassy")))]
pub struct Instant {}
#[cfg(all(not(feature = "std"), not(feature = "embassy")))]
impl Instant {
    /// Get the current time
    pub fn now() -> Instant {
        Self
    }
    /// Get the duration past since the provided instant
    pub fn duration_since(&self, _: Instant) -> Duration {
        // Just make sure double click fails
        Duration::from_millis(1_000_000)
    }
}

/// Duration is a core type, useful for all
pub use core::time::Duration;
