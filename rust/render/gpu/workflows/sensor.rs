use crate::{render::RenderContext, style::SensorWorkflowLayerGuideGPU, ui::TimeCache};
use alloc::{collections::BTreeMap, rc::Rc};
use core::cell::RefCell;

/// Sensor Source
#[derive(Debug, Clone)]
#[allow(missing_docs)]
pub struct SensorSource {
    pub texture: Option<wgpu::Texture>,
}

#[derive(Debug)]
#[allow(missing_docs)]
pub struct SensorWorkflow {
    context: Rc<RefCell<RenderContext>>,
    pub layer_guides: BTreeMap<u32, Rc<RefCell<SensorWorkflowLayerGuideGPU>>>,
}
impl SensorWorkflow {
    /// Create a new sensor workflow
    pub fn new(context: Rc<RefCell<RenderContext>>) -> Self {
        Self { context, layer_guides: BTreeMap::new() }
    }

    /// Inject a time cache into the sensor workflow for future rendering
    pub fn inject_time_cache(&mut self, time_cache: &TimeCache) {
        todo!()
    }
}
