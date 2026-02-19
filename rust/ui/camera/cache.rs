use alloc::{
    collections::{BTreeMap, VecDeque},
    vec::Vec,
};
use core::cell::{RefCell, RefMut};

/// Fixed-size LRU cache.
/// Evicts least-recently-used items and calls `delete()` on them.
#[derive(Debug, Clone, PartialEq)]
pub struct Cache<U: Ord + Clone, T> {
    max_cache_size: usize,
    order: VecDeque<U>,
    map: BTreeMap<U, RefCell<T>>,
}
impl<U: Ord + Clone, T> Cache<U, T> {
    /// Create a new cache
    pub fn new(max_cache_size: Option<usize>) -> Self {
        Self {
            max_cache_size: max_cache_size.unwrap_or(100),
            order: VecDeque::new(),
            map: BTreeMap::new(),
        }
    }

    /// Set a value. Move key to front. Evict if over limit.
    pub fn set(&mut self, key: U, value: T) {
        // Remove if already present in order
        if let Some(pos) = self.order.iter().position(|k| k == &key) {
            self.order.remove(pos);
        }
        // Push to front
        self.order.insert(0, key.clone());
        // Insert into map
        self.map.insert(key, RefCell::new(value));
        // Evict excess items
        while self.order.len() > self.max_cache_size {
            if let Some(evicted_key) = self.order.pop_back() {
                self.map.remove(&evicted_key);
            }
        }
    }

    fn touched(&mut self, key: &U) {
        // Remove old position
        if let Some(pos) = self.order.iter().position(|k| k == key) {
            self.order.remove(pos);
        }
        // Add to front
        self.order.push_front(key.clone());
    }

    /// Get a batch of values, updating LRU order for each.
    pub fn get(&'_ mut self, key: &U) -> Option<RefMut<'_, T>> {
        self.touched(key);
        self.map.get(key).map(|v| v.borrow_mut())
    }

    /// Get a batch of values, updating LRU order for each.
    pub fn get_batch(&'_ mut self, keys: &[U]) -> Vec<RefMut<'_, T>> {
        let mut out: Vec<RefMut<T>> = Vec::new();
        keys.iter().for_each(|k| self.touched(k));
        for key in keys {
            if let Some(v) = self.map.get(key) {
                out.push(v.borrow_mut());
            }
        }
        out
    }

    /// Return all values in LRU order.
    pub fn get_all(&'_ mut self) -> Vec<RefMut<'_, T>> {
        let keys: Vec<U> = self.order.iter().cloned().collect();
        self.get_batch(&keys)
    }

    /// Delete a key, calling its delete().
    pub fn delete(&mut self, key: &U) -> bool {
        if let Some(pos) = self.order.iter().position(|k| k == key) {
            self.order.remove(pos);
        }

        if let Some(_) = self.map.remove(key) { true } else { false }
    }

    /// Delete all entries.
    pub fn delete_all(&mut self) {
        self.map.clear();
        self.order.clear();
    }
}
