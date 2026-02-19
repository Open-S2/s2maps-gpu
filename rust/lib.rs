#![cfg_attr(not(feature = "std"), no_std)]
#![deny(missing_docs)]
#![cfg_attr(docsrs, feature(doc_cfg))]
#![warn(clippy::collapsible_if)]
// NOTE: Once coverage stabilizes, we can simplify this https://github.com/rust-lang/rust/issues/84605
#![cfg_attr(feature = "nightly", feature(coverage_attribute))]
//! # The S2 Map GPU Engine 🌎 🗺️
//!
//! ```text
//!   ad88888ba   ad888888b,    88b           d88
//!  d8"     "8b d8"     "88    888b         d888
//!  Y8,                 a8P    88`8b       d8'88
//!  `Y8aaaaa,        ,d8P"     88 `8b     d8' 88 ,adPPYYba, 8b,dPPYba,  ,adPPYba,
//!    `"""""8b,    a8P"        88  `8b   d8'  88 ""     `Y8 88P'    "8a I8[    ""
//!          `8b  a8P'          88   `8b d8'   88 ,adPPPPP88 88       d8  `"Y8ba,
//!  Y8a     a8P d8"            88    `888'    88 88,    ,88 88b,   ,a8" aa    ]8I
//!   "Y88888P"  88888888888    88     `8'     88 `"8bbdP"Y8 88`YbbdP"'  `"YbbdP"'
//!                                                          88
//!                                                          88
//! ```
//!
//! ## Description
//!
//! Both an **S2** and **WM** Projection Map Engine Powered by `WebGL1`, `WebGL2`, and `WebGPU`.
//!
//! ## Install
//!
//! ```bash
//! cargo add s2maps-gpu
//! ```

extern crate alloc;

/// Rendering Tools
pub mod render;
/// The S2 Map GPU Engine
pub mod s2map;
/// Source Data
pub mod source;
/// Style
pub mod style;
/// UI
pub mod ui;
/// Utilities
pub mod util;
/// Workers
pub mod workers;

/// Creator of the library:
/// Github handle - `@CraigglesO`
/// LinkedIn - https://www.linkedin.com/in/craig-oconnor/
/// Alias - Mr. Martian
pub const CREATOR: &str = "Mr. Martian"; // I'm a martian, I come from Mars
