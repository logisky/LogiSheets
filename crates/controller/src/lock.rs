//! Since this library should be used in these two circumstances:
//! - standalone version. This is used in the browser or as a rust library which is single threaded.
//! - sequencer version. This is used in the sequencer to support the co-working
//!
//! We don't want any compromise on the performance in the standalone version and we redefined a locked type,
//! which is designed to use `RefCell` or `RwLock` depends on the feature.
//!
//! Ref: https://github.com/rhaiscript/rhai/blob/main/src/func/native.rs#L554

#[cfg(not(feature = "sequencer"))]
pub use std::cell::RefCell as Locked;

#[cfg(not(feature = "sequencer"))]
pub type LockGuard<'a, T> = std::cell::Ref<'a, T>;

#[cfg(not(feature = "sequencer"))]
pub type LockGuardMut<'a, T> = std::cell::RefMut<'a, T>;

#[cfg(feature = "sequencer")]
// pub use std::sync::RwLock as Locked;
pub type Locked<T> = std::sync::Arc<std::sync::RwLock<T>>;

#[cfg(feature = "sequencer")]
#[allow(dead_code)]
pub type LockGuard<'a, T> = std::sync::RwLockReadGuard<'a, T>;

#[cfg(feature = "sequencer")]
#[allow(dead_code)]
pub type LockGuardMut<'a, T> = std::sync::RwLockWriteGuard<'a, T>;

#[inline(always)]
#[must_use]
#[allow(dead_code)]
pub fn locked_read<T>(value: &Locked<T>) -> LockGuard<T> {
    #[cfg(not(feature = "sequencer"))]
    return value.borrow();

    #[cfg(feature = "sequencer")]
    return value.read().unwrap();
}

#[inline(always)]
#[must_use]
#[allow(dead_code)]
pub fn locked_write<T>(value: &Locked<T>) -> LockGuardMut<T> {
    #[cfg(not(feature = "sequencer"))]
    return value.borrow_mut();

    #[cfg(feature = "sequencer")]
    return value.write().unwrap();
}
