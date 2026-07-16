use crate::{
    render::{
        Features, MaskSourceSpec, RenderContext, TileMaskSource, WebGPUBuffer, default_blend,
    },
    source::Tile,
    style::{
        EncodeLayerAttribute, FillDefinition, FillStyle, FillWorkflowLayerGuide,
        FillWorkflowLayerGuideGPU, Input, InputOnlyStep, LayerDefinitionBase,
        LayerWorkflowGuideBase, Projection,
    },
    workers::FillData,
};
use alloc::{collections::BTreeMap, rc::Rc};
use core::cell::RefCell;

/// Fill Source
#[derive(Debug, Clone)]
#[allow(missing_docs)]
pub struct FillSource {
    pub vertex_buffer: WebGPUBuffer,
    pub index_buffer: WebGPUBuffer,
    pub id_buffer: WebGPUBuffer,
    pub code_type_buffer: WebGPUBuffer,
}
impl FillSource {
    /// Create a new fill source
    pub fn new(context: &RenderContext, fill_data: &FillData) -> Self {
        Self {
            vertex_buffer: context.build_gpu_buffer(
                "Fill Vertex Buffer",
                &fill_data.vertex_buffer,
                wgpu::BufferUsages::VERTEX | wgpu::BufferUsages::STORAGE,
                None,
            ),
            index_buffer: context.build_gpu_buffer(
                "Fill Index Buffer",
                &fill_data.index_buffer,
                wgpu::BufferUsages::INDEX | wgpu::BufferUsages::STORAGE,
                None,
            ),
            id_buffer: context.build_gpu_buffer(
                "Fill ID Buffer",
                &fill_data.id_buffer,
                wgpu::BufferUsages::VERTEX | wgpu::BufferUsages::STORAGE,
                None,
            ),
            code_type_buffer: context.build_gpu_buffer(
                "Fill Code Type Buffer",
                &fill_data.code_type_buffer,
                wgpu::BufferUsages::VERTEX,
                None,
            ),
        }
    }
}

/// Fill or Mask Source
#[derive(Debug, Clone)]
#[allow(missing_docs)]
pub enum FillOrMaskSource {
    Fill(Rc<FillSource>),
    Mask(Rc<TileMaskSource>),
}
impl MaskSourceSpec for FillOrMaskSource {}
impl FillOrMaskSource {
    /// Get the mask from the source
    pub fn mask(&self) -> &TileMaskSource {
        match self {
            FillOrMaskSource::Fill(_) => panic!("Source is not a mask"),
            FillOrMaskSource::Mask(source) => source,
        }
    }
    /// Get a reference to the vertex buffer
    pub fn vertex_buffer(&self) -> &WebGPUBuffer {
        match self {
            FillOrMaskSource::Fill(source) => &source.vertex_buffer,
            FillOrMaskSource::Mask(source) => &source.mask.vertex_buffer,
        }
    }
    /// Get a reference to the index buffer
    pub fn index_buffer(&self) -> &WebGPUBuffer {
        match self {
            FillOrMaskSource::Fill(source) => &source.index_buffer,
            FillOrMaskSource::Mask(source) => &source.mask.index_buffer,
        }
    }
    /// Get a reference to the index buffer
    pub fn code_type_buffer(&self) -> &WebGPUBuffer {
        match self {
            FillOrMaskSource::Fill(source) => &source.code_type_buffer,
            FillOrMaskSource::Mask(source) => &source.mask.code_type_buffer,
        }
    }
    /// Get the ID buffer
    pub fn id_buffer(&self) -> Option<&WebGPUBuffer> {
        match self {
            FillOrMaskSource::Fill(source) => Some(&source.id_buffer),
            _ => None,
        }
    }
}
impl From<Rc<FillSource>> for FillOrMaskSource {
    fn from(source: Rc<FillSource>) -> Self {
        FillOrMaskSource::Fill(source)
    }
}
impl From<Rc<TileMaskSource>> for FillOrMaskSource {
    fn from(source: Rc<TileMaskSource>) -> Self {
        FillOrMaskSource::Mask(source)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum PipelineType {
    Fill,
    Mask,
    Invert,
    MaskFill,
}
impl alloc::fmt::Display for PipelineType {
    fn fmt(&self, f: &mut alloc::fmt::Formatter<'_>) -> alloc::fmt::Result {
        write!(f, "{:?}", self)
    }
}

/// Fill Feature is a standalone fill render storage unit that can be drawn to the GPU
#[derive(Debug, Clone)]
#[allow(missing_docs)]
pub struct FillFeature {
    pub bind_group: wgpu::BindGroup,
    pub fill_pattern_bind_group: wgpu::BindGroup,
    pub fill_interactive_bind_group: Option<wgpu::BindGroup>,
    // input variables
    pub workflow: Rc<RefCell<FillWorkflow>>,
    pub layer_guide: Rc<RefCell<FillWorkflowLayerGuideGPU>>,
    pub mask_layer: bool,
    pub source: FillOrMaskSource,
    pub count: u32,
    pub offset: u32,
    pub tile: Rc<RefCell<Tile>>,
    pub feature_code_buffer: WebGPUBuffer,
    pub fill_texture_positions: WebGPUBuffer,
    pub fill_interactive_buffer: Option<WebGPUBuffer>,
    pub feature_code: Vec<f32>, // number[] = [0],
    pub parent: Option<Rc<RefCell<Tile>>>,
}
impl FillFeature {
    /// Create a new fill feature
    ///
    /// ## Parameters
    /// - `workflow`: the fill workflow
    /// - `layer_guide`: the layer guide for this feature
    /// - `mask_layer`: whether or not the layer is a mask type or not
    /// - `source`: the fill or mask source
    /// - `count`: the number of points
    /// - `offset`: the offset of the points
    /// - `tile`: the tile that the feature is drawn on
    /// - `feature_code_buffer`: the encoded feature code that tells the GPU how to compute it's properties
    /// - `fill_texture_positions`: the fill texture positions
    /// - `fill_interactive_buffer`: if interactive, this buffer helps the GPU compute interactivity
    /// - `feature_code`: the encoded feature code that tells the GPU how to compute it's properties
    /// - `parent`: the parent tile if applicable
    pub fn new(
        workflow: Rc<RefCell<FillWorkflow>>,
        layer_guide: Rc<RefCell<FillWorkflowLayerGuideGPU>>,
        mask_layer: bool,
        source: FillOrMaskSource,
        count: u32,
        offset: u32,
        tile: Rc<RefCell<Tile>>,
        feature_code_buffer: WebGPUBuffer,
        fill_texture_positions: WebGPUBuffer,
        fill_interactive_buffer: Option<WebGPUBuffer>,
        feature_code: Option<Vec<f32>>,
        parent: Option<Rc<RefCell<Tile>>>,
    ) -> Self {
        let context = workflow.borrow().context.clone();
        let fill_pattern_bind_group =
            context.borrow().create_pattern_bind_group(&fill_texture_positions, None, None);
        let bind_group = FillFeature::_build_bind_group(
            context.clone(),
            tile.clone(),
            parent.clone(),
            layer_guide.clone(),
            &feature_code_buffer,
        );
        let fill_interactive_bind_group =
            if let Some(fill_interactive_buffer) = &fill_interactive_buffer {
                Some(FillFeature::_build_interactive_bind_group(
                    context.clone(),
                    workflow.clone(),
                    fill_interactive_buffer,
                    &source,
                ))
            } else {
                None
            };
        FillFeature {
            bind_group,
            fill_pattern_bind_group,
            fill_interactive_bind_group,
            workflow,
            layer_guide,
            mask_layer,
            source,
            count,
            offset,
            tile,
            feature_code_buffer,
            fill_texture_positions,
            fill_interactive_buffer,
            feature_code: feature_code.unwrap_or(vec![0.0]),
            parent,
        }
    }

    /** Draw the feature */
    pub fn draw(&self) {
        let mask_source = &self.parent.as_ref().unwrap_or(&self.tile).borrow().mask;
        let workflow = &mut self.workflow.borrow_mut();
        workflow.context.borrow_mut().set_stencil_reference(self.tile.borrow().tmp_mask_id);
        if self.mask_layer {
            workflow.draw_mask(mask_source, Some(&self));
        } else {
            workflow.draw(&self);
        }
    }

    /** Compute the feature's interactivity with the mouse */
    pub fn compute(&mut self) {
        self.workflow.borrow_mut().compute_interactive(self);
    }

    /** Update the shared texture's bind groups */
    pub fn update_shared_texture(&mut self) {
        self.fill_pattern_bind_group =
            self.workflow.borrow_mut().context.borrow().create_pattern_bind_group(
                &self.fill_texture_positions,
                None,
                Some("Fill Pattern BindGroup"),
            );
    }

    /**
     * Duplicate this point
     * @param tile - the tile that is being duplicated
     * @param parent - the parent tile if applicable
     * @returns the duplicated feature
     */
    pub fn duplicate(
        &self,
        tile: Rc<RefCell<Tile>>,
        parent: Option<Rc<RefCell<Tile>>>,
    ) -> FillFeature {
        let binding = self.workflow.borrow();
        let context = binding.context.borrow();
        let mut c_e =
            context.device.create_command_encoder(&wgpu::CommandEncoderDescriptor::default());
        let new_feature_code_buffer =
            context.duplicate_gpu_buffer(&self.feature_code_buffer, &mut c_e);
        let new_fill_texture_positions =
            context.duplicate_gpu_buffer(&self.fill_texture_positions, &mut c_e);
        let new_fill_interactive_buffer = self
            .fill_interactive_buffer
            .as_ref()
            .map(|buffer| context.duplicate_gpu_buffer(buffer, &mut c_e));
        context.queue.submit([c_e.finish()]);
        core::mem::drop(context);
        core::mem::drop(binding);
        FillFeature::new(
            self.workflow.clone(),
            self.layer_guide.clone(),
            self.mask_layer,
            self.source.clone(),
            self.count,
            self.offset,
            tile,
            new_feature_code_buffer,
            new_fill_texture_positions,
            new_fill_interactive_buffer,
            Some(self.feature_code.clone()),
            parent,
        )
    }

    /**
     * Build the bind group for the fill feature
     * @returns the GPU Bind Group for the fill feature
     */
    fn _build_bind_group(
        context: Rc<RefCell<RenderContext>>,
        tile: Rc<RefCell<Tile>>,
        parent: Option<Rc<RefCell<Tile>>>,
        layer_guide: Rc<RefCell<FillWorkflowLayerGuideGPU>>,
        feature_code_buffer: &WebGPUBuffer,
    ) -> wgpu::BindGroup {
        let mask = &parent.as_ref().unwrap_or(&tile).borrow().mask;
        let context = context.borrow();
        context.build_group(
            "Fill Feature BindGroup",
            context.feature_bind_group_layout.as_ref().unwrap(),
            &[
                &mask.uniform_buffer,
                &mask.position_buffer,
                &layer_guide.borrow().layer_buffer,
                &layer_guide.borrow().layer_code_buffer,
                feature_code_buffer,
            ],
        )
    }

    /**
     * Build an interactive bind group for this feature
     * @returns the GPU Bind Group
     */
    fn _build_interactive_bind_group(
        context: Rc<RefCell<RenderContext>>,
        workflow: Rc<RefCell<FillWorkflow>>,
        fill_interactive_buffer: &WebGPUBuffer,
        source: &FillOrMaskSource,
    ) -> wgpu::BindGroup {
        let id_buffer =
            source.id_buffer().unwrap_or_else(|| panic!("Source does not have an idBuffer"));
        context.borrow().build_group(
            "Fill Interactive BindGroup",
            &workflow.borrow().fill_interactive_bind_group_layout,
            &[fill_interactive_buffer, source.vertex_buffer(), source.index_buffer(), id_buffer],
        )
    }
}

/// Fill Workflow
#[derive(Debug)]
#[allow(missing_docs)]
pub struct FillWorkflow {
    context: Rc<RefCell<RenderContext>>,
    pub layer_guides: BTreeMap<u32, Rc<RefCell<FillWorkflowLayerGuideGPU>>>,
    // shader_module: wgpu::ShaderModule,
    // render
    // pipeline_layout: wgpu::PipelineLayout,
    mask_pipeline: wgpu::RenderPipeline,
    fill_pipeline: wgpu::RenderPipeline,
    mask_fill_pipeline: wgpu::RenderPipeline,
    invert_pipeline: wgpu::RenderPipeline,
    // compute
    fill_interactive_bind_group_layout: wgpu::BindGroupLayout,
    interactive_pipeline: wgpu::ComputePipeline,
}
impl FillWorkflow {
    /** @param context - The WebGPU context */
    pub fn new(context: Rc<RefCell<RenderContext>>) -> Self {
        let shader_module = context.borrow().device.create_shader_module(wgpu::include_wgsl!(
            "../../../../s2/render/gpu/shaders/fill.wgsl"
        ));
        let pipeline_layout = {
            let context = context.borrow();
            context.device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
                label: Some("Fill Pipeline Layout"),
                bind_group_layouts: &[
                    context.frame_bind_group_layout.as_ref(),
                    context.feature_bind_group_layout.as_ref(),
                    context.mask_pattern_bind_group_layout.as_ref(),
                ],
                immediate_size: 0,
            })
        };
        let mask_pipeline = FillWorkflow::_get_pipeline(
            &shader_module,
            &pipeline_layout,
            context.clone(),
            PipelineType::Mask,
        );
        let fill_pipeline = FillWorkflow::_get_pipeline(
            &shader_module,
            &pipeline_layout,
            context.clone(),
            PipelineType::Fill,
        );
        let mask_fill_pipeline = FillWorkflow::_get_pipeline(
            &shader_module,
            &pipeline_layout,
            context.clone(),
            PipelineType::MaskFill,
        );
        let invert_pipeline = FillWorkflow::_get_pipeline(
            &shader_module,
            &pipeline_layout,
            context.clone(),
            PipelineType::Invert,
        );
        let (fill_interactive_bind_group_layout, interactive_pipeline) =
            FillWorkflow::_get_compute_pipeline(&shader_module, context.clone());

        Self {
            context,
            layer_guides: BTreeMap::new(),
            // shader_module,
            // pipeline_layout,
            mask_pipeline,
            fill_pipeline,
            mask_fill_pipeline,
            invert_pipeline,
            fill_interactive_bind_group_layout,
            interactive_pipeline,
        }
    }

    /**
     * Build the layer definition for this workflow
     * @param layer_base - the common layer attributes
     * @param layer - the user defined layer attributes
     * @returns a built layer definition that's ready to describe how to render a feature
     */
    pub fn build_layer_definition(
        &mut self,
        layer_base: LayerDefinitionBase,
        layer: &FillStyle,
    ) -> FillDefinition {
        let context = &mut self.context.borrow_mut();
        // PRE) get layer base
        let FillStyle {
            pattern,
            color,
            opacity,
            pattern_family,
            pattern_movement,
            invert,
            opaque,
            interactive,
            cursor,
            ..
        } = layer.clone();
        let has_pattern = pattern.is_some();
        let invert = invert.unwrap_or(false);
        let opaque = opaque.unwrap_or(false);
        let interactive = interactive.unwrap_or(false);
        let cursor = cursor.unwrap_or("default".into());
        // 1) build definition
        let color = color.unwrap_or(Input::Value("rgb(0, 0, 0)".into()));
        let opacity = opacity.unwrap_or(Input::Value(1.0));
        let pattern_family = pattern_family.unwrap_or(InputOnlyStep::Value("__images".into()));
        let pattern_movement = pattern_movement.unwrap_or(InputOnlyStep::Value(false));
        // 2) build the layer_code
        let mut layer_code = vec![];
        layer_code.extend(color.encode_attribute(layer_base.lch));
        layer_code.extend(opacity.encode_attribute(layer_base.lch));
        // store
        let layer_definition = FillDefinition {
            base: layer_base.clone(),
            // paint
            color,
            opacity,
            // layout
            pattern,
            pattern_family,
            pattern_movement,
            // propreties
            invert,
            interactive,
            opaque,
            cursor,
        };
        let LayerDefinitionBase { source, layer_index, lch, visible, .. } = layer_base;
        // 3) Setup layer buffers in GPU
        let layer_buffer = context.build_gpu_buffer(
            "Layer Uniform Buffer",
            &vec![RenderContext::get_depth_position(layer_index as u32), lch as u32 as f32],
            wgpu::BufferUsages::UNIFORM,
            None,
        );
        let layer_code_buffer = context.build_gpu_buffer(
            "Layer Code Buffer",
            &layer_code,
            wgpu::BufferUsages::STORAGE,
            None,
        );
        // 4) Store layer guide
        self.layer_guides.insert(
            layer_index,
            Rc::new(RefCell::new(FillWorkflowLayerGuideGPU {
                layer_buffer,
                layer_code_buffer,
                guide: FillWorkflowLayerGuide {
                    base: LayerWorkflowGuideBase {
                        source_name: source.clone(),
                        layer_index,
                        layer_code,
                        lch,
                        visible,
                        interactive,
                        opaque,
                    },
                    color: None,
                    opacity: None,
                    invert,
                    pattern: has_pattern,
                },
            })),
        );

        layer_definition
    }

    /**
     * given a set of layer_indexes that use Masks and the tile of interest
     * @param definition - layer definition that uses masks
     * @param tile - the tile that needs a mask
     */
    pub fn build_mask_feature(
        workflow: Rc<RefCell<FillWorkflow>>,
        definition: &FillDefinition,
        tile: Rc<RefCell<Tile>>,
    ) {
        let fill_work = &workflow.borrow();
        let tile_ref = &mut tile.borrow_mut();
        // not in the zoom range, ignore
        if tile_ref.zoom < definition.base.minzoom || tile_ref.zoom > definition.base.maxzoom {
            return;
        }

        let layer_guide = fill_work.layer_guides.get(&definition.base.layer_index);
        if layer_guide.is_none() {
            return;
        }
        let layer_guide = layer_guide.unwrap();
        let feature_code: Vec<f32> = vec![0.];
        let feature_code_buffer = fill_work.context.borrow().build_gpu_buffer(
            "Feature Code Buffer",
            &feature_code,
            wgpu::BufferUsages::STORAGE,
            None,
        );
        let fill_texture: Vec<f32> = vec![0., 0., 0., 0., 0.];
        let fill_texture_positions = fill_work.context.borrow().build_gpu_buffer(
            "Fill Texture Positions",
            &fill_texture,
            wgpu::BufferUsages::UNIFORM,
            None,
        );
        let mask_source = &tile_ref.mask;
        let feature: Rc<RefCell<Features>> = Rc::new(RefCell::new(
            FillFeature::new(
                workflow.clone(),
                layer_guide.clone(),
                true,
                mask_source.clone().into(),
                mask_source.mask.count,
                mask_source.mask.offset,
                tile.clone(),
                feature_code_buffer,
                fill_texture_positions,
                None,
                None,
                None,
            )
            .into(),
        ));
        tile_ref.add_features(&[feature]);
    }

    /**
     * Build the source fill data into fill features
     * @param fillData - the input fill data
     * @param tile - the tile we are building the features for
     */
    pub fn build_source(
        workflow: Rc<RefCell<FillWorkflow>>,
        tile: Rc<RefCell<Tile>>,
        fill_data: &FillData,
    ) {
        // prep buffers and source
        let source: FillOrMaskSource =
            Rc::new(FillSource::new(&workflow.borrow().context.borrow(), fill_data)).into();
        // build features
        FillWorkflow::_build_features(workflow, source, tile, &fill_data.feature_guide_buffer);
    }

    /**
     * Build fill features from input fill source
     * @param source - the input fill source
     * @param tile - the tile we are building the features for
     * @param feature_guide_array - the feature guide to help build the features properties
     */
    fn _build_features(
        workflow: Rc<RefCell<FillWorkflow>>,
        source: FillOrMaskSource,
        tile: Rc<RefCell<Tile>>,
        feature_guide_array: &Vec<f32>,
    ) {
        let mut features: Vec<Rc<RefCell<Features>>> = vec![];

        let lgl = feature_guide_array.len();
        let mut i = 0;
        while i < lgl {
            // grab the size, layer_index, count, and offset, and update the index
            let [layer_index, count, offset, encoding_size] = feature_guide_array[i..i + 4] else {
                panic!("Invalid feature guide")
            };
            let encoding_size = encoding_size as usize;
            let count = count as u32;
            let offset = offset as u32;
            i += 4;
            // build feature_code
            let mut feature_code = vec![0.];
            if encoding_size > 0 {
                feature_code = feature_guide_array[i..(i + encoding_size)].into();
            }
            // update index
            i += encoding_size;
            // get the pattern
            let [tex_x, tex_y, tex_w, tex_h, pattern_movement] = feature_guide_array[i..i + 5]
            else {
                panic!("Invalid feature guide")
            };
            i += 5;

            let this = workflow.borrow();
            let context = this.context.borrow();
            let layer_guide = this.layer_guides.get(&(layer_index as u32));
            if layer_guide.is_none() {
                continue;
            }
            let layer_guide = layer_guide.cloned().unwrap();
            let feature_code_buffer = context.build_gpu_buffer(
                "Feature Code Buffer",
                &feature_code,
                wgpu::BufferUsages::STORAGE,
                None,
            );
            let fill_texture_positions = context.build_gpu_buffer(
                "Fill Texture Positions",
                &[tex_x, tex_y, tex_w, tex_h, pattern_movement],
                wgpu::BufferUsages::UNIFORM,
                None,
            );
            let fill_interactive_buffer = context.build_gpu_buffer(
                "Fill Interactive Buffer",
                &[offset / 3, count / 3],
                wgpu::BufferUsages::UNIFORM,
                None,
            );
            core::mem::drop(context);
            core::mem::drop(this);
            features.push(Rc::new(RefCell::new(
                FillFeature::new(
                    workflow.clone(),
                    layer_guide,
                    false,
                    source.clone(),
                    count,
                    offset,
                    tile.clone(),
                    feature_code_buffer,
                    fill_texture_positions,
                    Some(fill_interactive_buffer),
                    Some(feature_code),
                    None,
                )
                .into(),
            )));
        }

        tile.borrow_mut().add_features(&features);
    }

    /**
     * Get the associating pipeline with the input type
     * https://programmer.ink/think/several-best-practices-of-webgpu.html
     * BEST PRACTICE 6: it is recommended to create pipeline asynchronously
     * BEST PRACTICE 7: explicitly define pipeline layouts
     * @param type - pipeline type (fill, mask, invert, mask-fill)
     * @returns the pipeline
     */
    fn _get_pipeline(
        module: &wgpu::ShaderModule,
        pipeline_layout: &wgpu::PipelineLayout,
        context: Rc<RefCell<RenderContext>>,
        r#type: PipelineType,
    ) -> wgpu::RenderPipeline {
        let context = &mut context.borrow_mut();
        let invert = r#type == PipelineType::Invert; // 'invert';
        let mask = r#type == PipelineType::Mask; // 'mask';
        let mask_fill = r#type == PipelineType::MaskFill; // 'mask-fill';

        let stencil_state = wgpu::StencilFaceState {
            compare: if mask {
                wgpu::CompareFunction::Always
            } else {
                wgpu::CompareFunction::Equal
            },
            fail_op: wgpu::StencilOperation::Keep,
            depth_fail_op: wgpu::StencilOperation::Keep,
            pass_op: wgpu::StencilOperation::Replace,
        };

        let pipeline = context.device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
            label: Some(&format!("Fill {} Pipeline", r#type)),
            layout: Some(pipeline_layout),
            vertex: wgpu::VertexState {
                module,
                entry_point: Some("vMain"),
                compilation_options: wgpu::PipelineCompilationOptions::default(),
                buffers: &[
                    Some(wgpu::VertexBufferLayout {
                        // position
                        array_stride: 4 * 2,
                        step_mode: wgpu::VertexStepMode::Vertex,
                        attributes: &[wgpu::VertexAttribute {
                            shader_location: 0,
                            offset: 0,
                            format: wgpu::VertexFormat::Float32x2,
                        }],
                    }),
                    Some(wgpu::VertexBufferLayout {
                        // code
                        array_stride: 4,
                        step_mode: wgpu::VertexStepMode::Vertex,
                        attributes: &[wgpu::VertexAttribute {
                            shader_location: 1,
                            offset: 0,
                            format: wgpu::VertexFormat::Uint32,
                        }],
                    }),
                ],
            },
            fragment: Some(wgpu::FragmentState {
                module,
                entry_point: Some("fMain"),
                compilation_options: wgpu::PipelineCompilationOptions::default(),
                targets: &[Some(wgpu::ColorTargetState {
                    format: context.format,
                    blend: Some(default_blend()),
                    write_mask: if mask || invert {
                        wgpu::ColorWrites::empty()
                    } else {
                        wgpu::ColorWrites::ALL
                    },
                })],
            }),
            primitive: wgpu::PrimitiveState {
                topology: if mask || mask_fill {
                    wgpu::PrimitiveTopology::TriangleStrip
                } else {
                    wgpu::PrimitiveTopology::TriangleList
                },
                cull_mode: if context.projection == Projection::S2 {
                    Some(wgpu::Face::Back)
                } else {
                    Some(wgpu::Face::Front)
                },
                strip_index_format: if mask || mask_fill {
                    Some(wgpu::IndexFormat::Uint32)
                } else {
                    None
                },
                ..Default::default()
            },
            multisample: wgpu::MultisampleState {
                count: context.sample_count,
                mask: !0,
                alpha_to_coverage_enabled: false,
            },
            depth_stencil: Some(wgpu::DepthStencilState {
                format: wgpu::TextureFormat::Depth24PlusStencil8,
                depth_write_enabled: Some(!mask),
                depth_compare: if mask {
                    Some(wgpu::CompareFunction::Always)
                } else {
                    Some(wgpu::CompareFunction::Less)
                },
                stencil: wgpu::StencilState {
                    front: stencil_state,
                    back: stencil_state,
                    read_mask: 0xffffffff,
                    write_mask: 0xffffffff,
                },
                bias: wgpu::DepthBiasState::default(),
            }),
            multiview_mask: None,
            cache: None,
        });

        pipeline
    }

    /**
     * Build a compute pipeline to check for interactive fill data that interects with the mouse
     * https://programmer.ink/think/several-best-practices-of-webgpu.html
     * BEST PRACTICE 6: it is recommended to create pipeline asynchronously
     * BEST PRACTICE 7: explicitly define pipeline layouts
     * @returns the GPU compute pipeline
     */
    fn _get_compute_pipeline(
        module: &wgpu::ShaderModule,
        context: Rc<RefCell<RenderContext>>,
    ) -> (wgpu::BindGroupLayout, wgpu::ComputePipeline) {
        let context = &mut context.borrow_mut();

        let fill_interactive_bind_group_layout =
            context.device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
                label: Some("Fill Interactive BindGroupLayout"),
                entries: &[
                    // interactive offset & count
                    wgpu::BindGroupLayoutEntry {
                        binding: 0,
                        visibility: wgpu::ShaderStages::COMPUTE,
                        ty: wgpu::BindingType::Buffer {
                            ty: wgpu::BufferBindingType::Uniform,
                            has_dynamic_offset: false,
                            min_binding_size: None,
                        },
                        count: None,
                    },
                    // positions
                    wgpu::BindGroupLayoutEntry {
                        binding: 1,
                        visibility: wgpu::ShaderStages::COMPUTE,
                        ty: wgpu::BindingType::Buffer {
                            ty: wgpu::BufferBindingType::Storage { read_only: true },
                            has_dynamic_offset: false,
                            min_binding_size: None,
                        },
                        count: None,
                    },
                    // indexes
                    wgpu::BindGroupLayoutEntry {
                        binding: 2,
                        visibility: wgpu::ShaderStages::COMPUTE,
                        ty: wgpu::BindingType::Buffer {
                            ty: wgpu::BufferBindingType::Storage { read_only: true },
                            has_dynamic_offset: false,
                            min_binding_size: None,
                        },
                        count: None,
                    },
                    // ids
                    wgpu::BindGroupLayoutEntry {
                        binding: 3,
                        visibility: wgpu::ShaderStages::COMPUTE,
                        ty: wgpu::BindingType::Buffer {
                            ty: wgpu::BufferBindingType::Storage { read_only: true },
                            has_dynamic_offset: false,
                            min_binding_size: None,
                        },
                        count: None,
                    },
                ],
            });

        let layout = context.device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
            label: Some("Fill Interactive Pipeline Layout"),
            bind_group_layouts: &[
                context.frame_bind_group_layout.as_ref(),
                context.feature_bind_group_layout.as_ref(),
                Some(&fill_interactive_bind_group_layout),
                context.interactive_bind_group_layout.as_ref(),
            ],
            immediate_size: 0,
        });
        let pipeline = context.device.create_compute_pipeline(&wgpu::ComputePipelineDescriptor {
            label: Some("Fill Interactive Pipeline"),
            layout: Some(&layout),
            module,
            entry_point: Some("interactive"),
            compilation_options: wgpu::PipelineCompilationOptions::default(),
            cache: None,
        });

        (fill_interactive_bind_group_layout, pipeline)
    }

    /**
     * Draw a fill feature to the GPU
     * @param feature - fill feature guide
     */
    pub fn draw(&mut self, feature: &FillFeature) {
        let layer_guide = &feature.layer_guide.borrow().guide;
        // if the layer is not visible, move on
        if !layer_guide.base.visible {
            return;
        }
        let invert = layer_guide.invert;
        let pipeline = if invert { &mut self.invert_pipeline } else { &mut self.fill_pipeline };
        // setup pipeline, bind groups, & buffers
        self.context.borrow_mut().set_render_pipeline("Fill".into(), pipeline);
        // get current source data
        let mask_source = &feature.parent.as_ref().unwrap_or(&feature.tile).borrow().mask;
        let source = &feature.source;
        // grab the pass encoder and setup the bind groups
        {
            let context = &mut self.context.borrow_mut();
            let pass_encoder = &mut context.pass_encoder.as_ref().unwrap().borrow_mut();
            pass_encoder.set_bind_group(1, &feature.bind_group, &[]);
            pass_encoder.set_bind_group(2, &feature.fill_pattern_bind_group, &[]);
            pass_encoder.set_vertex_buffer(0, source.vertex_buffer().buffer.slice(..));
            pass_encoder.set_index_buffer(
                source.index_buffer().buffer.slice(..),
                wgpu::IndexFormat::Uint32,
            );
            pass_encoder.set_vertex_buffer(1, source.code_type_buffer().buffer.slice(..));
            // draw
            pass_encoder.draw_indexed(0..feature.count, 1, 0..feature.offset);
        }

        if invert {
            self.draw_mask(mask_source, Some(feature));
        }
        todo!()
    }

    /**
     * Draw a mask to the GPU
     * @param mask - mask source
     * @param feature - fill feature guide
     */
    pub fn draw_mask(&mut self, tile_mask: &TileMaskSource, feature: Option<&FillFeature>) {
        let mask = &tile_mask.mask;
        // if the layer is not visible, move on
        if let Some(feature) = feature
            && feature.layer_guide.borrow().guide.base.visible
        {
            return;
        }
        let context = &mut self.context.borrow_mut();
        // setup pipeline, bind groups, & buffers
        if feature.is_none() {
            context.set_render_pipeline("mask".into(), &mut self.mask_pipeline);
        } else {
            context.set_render_pipeline("mask_fill".into(), &mut self.mask_fill_pipeline);
        }
        // grap the pass encoder and setup draw mechanics
        let pass_encoder = &mut context.pass_encoder.as_ref().unwrap().borrow_mut();
        if let Some(feature) = feature {
            pass_encoder.set_bind_group(1, &feature.bind_group, &[]);
            pass_encoder.set_bind_group(2, &feature.fill_pattern_bind_group, &[]);
        } else {
            pass_encoder.set_bind_group(1, &tile_mask.bind_group, &[]);
            pass_encoder.set_bind_group(2, &tile_mask.fill_pattern_bind_group, &[]);
        }
        pass_encoder.set_vertex_buffer(0, mask.vertex_buffer.buffer.slice(..));
        pass_encoder
            .set_index_buffer(mask.index_buffer.buffer.slice(..), wgpu::IndexFormat::Uint32);
        pass_encoder.set_vertex_buffer(1, mask.code_type_buffer.buffer.slice(..));
        // draw
        pass_encoder.draw_indexed(0..mask.count, 1, 0..mask.offset);
    }

    /**
     * Compute the interactive fill features in current view
     * @param feature - fill feature guide
     */
    pub fn compute_interactive(&mut self, feature: &FillFeature) {
        if !feature.layer_guide.borrow().guide.base.visible
            || feature.fill_interactive_bind_group.is_none()
        {
            return;
        }
        let context = &mut self.context.borrow_mut();
        context.set_compute_pipeline("FillCompute".into(), &mut self.interactive_pipeline);
        // set bind group & draw
        let compute_pass = &mut context.compute_pass.as_ref().unwrap().borrow_mut();
        compute_pass.set_bind_group(1, &feature.bind_group, &[]);
        compute_pass.set_bind_group(2, feature.fill_interactive_bind_group.as_ref(), &[]);
        compute_pass.set_bind_group(3, &context.interactive_bind_group, &[]);
        let count = feature.count.div_ceil(3).div_ceil(64);
        compute_pass.dispatch_workgroups(count, count, count);
    }
}
