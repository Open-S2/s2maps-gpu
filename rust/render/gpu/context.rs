use crate::{
    render::{ContextSpec, MaskSource},
    s2map::ColorMode,
    style::{ColorArray, GPUType, Projection},
    ui::{MapOptions, Mat4, ProjectorView},
    workers::{GlyphImage, GlyphImages, SpriteImageMessage},
};
use alloc::{collections::BTreeMap, rc::Rc, vec::Vec};
use bytemuck::Pod;
use core::cell::RefCell;
use libm::powf;
use wgpu::{
    Adapter, AddressMode, BindGroup, BindGroupDescriptor, BindGroupEntry, BindGroupLayout,
    BindGroupLayoutDescriptor, BindGroupLayoutEntry, BindingResource, BindingType, BlendComponent,
    BlendFactor, BlendOperation, BlendState, Buffer, BufferBinding, BufferBindingType,
    BufferDescriptor, BufferUsages, CommandEncoder, CommandEncoderDescriptor, CompositeAlphaMode,
    ComputePass, ComputePassDescriptor, ComputePipeline, CurrentSurfaceTexture, Device,
    DeviceDescriptor, ExperimentalFeatures, Extent3d, Features, FilterMode, Limits, LoadOp,
    Operations, Origin3d, PowerPreference, Queue, RenderPass, RenderPassColorAttachment,
    RenderPassDepthStencilAttachment, RenderPassDescriptor, RenderPipeline, RequestAdapterOptions,
    Sampler, SamplerBindingType, SamplerDescriptor, ShaderStages, StoreOp, Surface,
    SurfaceConfiguration, TexelCopyBufferInfo, TexelCopyBufferLayout, TexelCopyTextureInfo,
    Texture, TextureAspect, TextureDescriptor, TextureDimension, TextureFormat, TextureSampleType,
    TextureUsages, TextureView, TextureViewDescriptor, TextureViewDimension, Trace,
};

/// Get the default blend state for this context
pub fn default_blend() -> BlendState {
    BlendState {
        color: BlendComponent {
            src_factor: BlendFactor::One,
            dst_factor: BlendFactor::OneMinusSrcAlpha,
            operation: BlendOperation::Add,
        },
        alpha: BlendComponent {
            src_factor: BlendFactor::One,
            dst_factor: BlendFactor::OneMinusSrcAlpha,
            operation: BlendOperation::Add,
        },
    }
}

/// Renaming of Extent3d
pub type Presentation = Extent3d;
/// A padded buffer guide
#[derive(Debug, Default, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct PaddedBuffer {
    pub data: Vec<u8>,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct WebGPUBuffer {
    pub label: Option<String>,
    pub size: u64,
    pub usage: BufferUsages,
    pub buffer: Buffer,
}
impl WebGPUBuffer {
    /// Create a new buffer wrapper
    pub fn new(label: Option<String>, size: u64, usage: BufferUsages, buffer: Buffer) -> Self {
        Self { label, size, usage, buffer }
    }
    /// Clone the buffer ensuring the GPU also has the copy
    pub fn clone(&self, device: &Device, command_encoder: &mut CommandEncoder) -> Self {
        let dst = device.create_buffer(&BufferDescriptor {
            label: self.label.as_deref(),
            size: self.size,
            usage: self.usage,
            mapped_at_creation: false,
        });

        command_encoder.copy_buffer_to_buffer(&self.buffer, 0, &dst, 0, self.size);

        Self { label: self.label.clone(), size: self.size, usage: self.usage, buffer: dst }
    }
    /// Setup an empty buffer
    pub fn empty(device: &Device) -> Self {
        let buffer = device.create_buffer(&BufferDescriptor {
            label: "Empty Buffer".into(),
            size: 0,
            usage: BufferUsages::empty(),
            mapped_at_creation: false,
        });
        Self { label: None, size: 0, usage: BufferUsages::empty(), buffer }
    }
}

/// # WebGPU Context
///
/// Wrapper to manage state and GPU calls for a WebGPU context
#[derive(Debug)]
#[allow(missing_docs)]
pub struct RenderContext {
    pub ready: bool,
    // constants/semi-constants
    pub r#type: GPUType,  // specifying that we are using a RenderContext
    pub renderer: String, // ex: AMD Radeon Pro 560 OpenGL Engine (https://github.com/pmndrs/detect-gpu)
    pub surface: Surface<'static>,
    pub device: Device,
    pub queue: Queue,
    pub presentation: Presentation,
    adapter: Adapter,
    pub device_pixel_ratio: f32,
    pub interactive: bool,
    pub projection: Projection,
    pub format: TextureFormat,
    pub masks: BTreeMap<u32, Rc<MaskSource>>,
    pub sample_count: u32,
    pub clear_color_rgba: ColorArray,
    // manage buffers, layouts, and bind groups
    pub null_texture: Option<Texture>,
    pub shared_texture: Option<Texture>,
    interactive_read_buffer: WebGPUBuffer,
    interactive_index_buffer: WebGPUBuffer,
    interactive_result_buffer: WebGPUBuffer,
    pub interactive_bind_group_layout: Option<BindGroupLayout>,
    pub interactive_bind_group: Option<BindGroup>,
    pub mask_pattern_bind_group_layout: Option<BindGroupLayout>,
    pub default_sampler: Option<Sampler>,
    pub pattern_sampler: Option<Sampler>,
    view_uniform_buffer: WebGPUBuffer,
    matrix_uniform_buffer: WebGPUBuffer,
    pub frame_bind_group_layout: Option<BindGroupLayout>,
    pub feature_bind_group_layout: Option<BindGroupLayout>,
    pub frame_buffer_bind_group: Option<BindGroup>,
    render_target: Option<Texture>,
    depth_stencil_texture: Option<Texture>,
    // frame specific variables
    pub command_encoder: Option<CommandEncoder>,
    pub pass_encoder: Option<RefCell<RenderPass<'static>>>,
    pub compute_pass: Option<RefCell<ComputePass<'static>>>,
    // pub compute_pass: ComputePass,
    pub resize_next_frame: Option<Presentation>, // = false;
    // track current states
    pub color_mode: ColorMode, // ColorMode = 0;
    pub stencil_ref: u32,      // = -1;
    pub curr_pipeline: Option<String>,
    pub finding_feature: bool, // = false;

    curr_view: Option<TextureView>,
    curr_resolve_target: Option<TextureView>,
}
impl ContextSpec for RenderContext {}
impl RenderContext {
    /**
     * @param context - The WebGPU context
     * @param options - map options
     */
    pub async fn new(window: &winit::window::Window, options: &MapOptions) -> Self {
        let size = window.inner_size();
        let (width, height) = (size.width, size.height);
        let created_context = create_gpu_context(window).await;
        let (adapter, device, queue, surface) = created_context;

        let interactive_read_buffer = WebGPUBuffer::empty(&device);
        let interactive_index_buffer = WebGPUBuffer::empty(&device);
        let interactive_result_buffer = WebGPUBuffer::empty(&device);
        let view_uniform_buffer = WebGPUBuffer::empty(&device);
        let matrix_uniform_buffer = WebGPUBuffer::empty(&device);

        let mut this = Self {
            ready: false,
            r#type: GPUType::WebGPU,
            renderer: "".into(),
            surface,
            device,
            queue,
            presentation: Presentation { width, height, depth_or_array_layers: 1 },
            adapter,
            device_pixel_ratio: options.canvas_multiplier.unwrap_or(1.) as f32,
            interactive: options.interactive.unwrap_or(true),
            projection: options.style.projection().unwrap_or(Projection::S2),
            format: TextureFormat::Rgba8Unorm,
            masks: BTreeMap::default(),
            sample_count: 1,
            clear_color_rgba: ColorArray(0., 0., 0., 0.),
            null_texture: None,
            shared_texture: None,
            interactive_read_buffer,
            interactive_index_buffer,
            interactive_result_buffer,
            interactive_bind_group_layout: None,
            interactive_bind_group: None,
            mask_pattern_bind_group_layout: None,
            default_sampler: None,
            pattern_sampler: None,
            view_uniform_buffer,
            matrix_uniform_buffer,
            frame_bind_group_layout: None,
            feature_bind_group_layout: None,
            frame_buffer_bind_group: None,
            render_target: None,
            depth_stencil_texture: None,
            command_encoder: None,
            pass_encoder: None,
            compute_pass: None,
            resize_next_frame: None,
            color_mode: ColorMode::None,
            stencil_ref: u32::MAX,
            curr_pipeline: None,
            finding_feature: false,
            curr_view: None,
            curr_resolve_target: None,
        };

        // prep uniform/storage buffers
        this._build_context_storage_groups_and_layouts();
        // set size
        this._resize(width, height);
        // update state
        this.ready = true;

        this
    }

    /**
     * @param view - the view matrix
     * @param matrix - the projection matrix
     */
    pub fn new_scene(&mut self, view: &ProjectorView, matrix: &Mat4) {
        // reset current pipeline
        self.curr_pipeline = None;
        // reset stencil ref
        self.stencil_ref = u32::MAX;
        // if a resize was called, let's do that first
        if let Some(resize) = self.resize_next_frame {
            self._resize(resize.width, resize.height);
        }
        // prepare descriptor
        let ColorArray(r, g, b, a) = self.clear_color_rgba;
        let current_texture = match self.surface.get_current_texture() {
            CurrentSurfaceTexture::Success(surface_texture)
            | CurrentSurfaceTexture::Suboptimal(surface_texture) => surface_texture,
            _ => panic!("Unable to get current texture"),
        };
        self.curr_view = Some(
            (self.render_target.as_ref().unwrap_or(&current_texture.texture))
                .create_view(&TextureViewDescriptor::default()),
        );
        self.curr_resolve_target = self
            .render_target
            .as_ref()
            .map(|_| current_texture.texture.create_view(&TextureViewDescriptor::default()));
        // Create our render pass descriptor
        let render_pass_descriptor = RenderPassDescriptor {
            label: Some("Render Pass"),
            color_attachments: &vec![Some(RenderPassColorAttachment {
                view: self.curr_view.as_ref().unwrap(),
                resolve_target: self.curr_resolve_target.as_ref(),
                ops: Operations {
                    load: LoadOp::Clear(wgpu::Color { r, g, b, a }),
                    store: StoreOp::Store,
                },
                depth_slice: None,
            })],
            depth_stencil_attachment: Some(RenderPassDepthStencilAttachment {
                view: &self
                    .depth_stencil_texture
                    .as_ref()
                    .unwrap()
                    .create_view(&TextureViewDescriptor::default()),
                depth_ops: Some(Operations { load: LoadOp::Clear(1.0), store: StoreOp::Store }),
                stencil_ops: Some(Operations { load: LoadOp::Clear(0), store: StoreOp::Store }),
            }),
            timestamp_writes: None,
            occlusion_query_set: None,
            multiview_mask: None,
        };
        // set encoders
        self.command_encoder =
            Some(self.device.create_command_encoder(&CommandEncoderDescriptor::default()));
        let pass_encoder =
            self.command_encoder.as_mut().unwrap().begin_render_pass(&render_pass_descriptor);
        self.pass_encoder = Some(RefCell::new(pass_encoder.forget_lifetime()));

        // setup view and matrix uniforms immediately
        self.queue.write_buffer(&self.matrix_uniform_buffer.buffer, 0, bytemuck::bytes_of(matrix));
        self.queue.write_buffer(&self.view_uniform_buffer.buffer, 4, bytemuck::bytes_of(view));

        // setup bind groups
        self.pass_encoder.as_mut().unwrap().borrow_mut().set_bind_group(
            0,
            &self.frame_buffer_bind_group,
            &[],
        );
    }

    /// Start a compute pass
    pub fn new_compute(&mut self, command_encoder: &mut CommandEncoder) {
        let compute_pass = command_encoder.begin_compute_pass(&ComputePassDescriptor::default());
        self.compute_pass = Some(RefCell::new(compute_pass.forget_lifetime()));
    }

    /** Clear the interaction buffer */
    pub fn clear_interact_buffer(&self) {
        self.queue.write_buffer(&self.interactive_index_buffer.buffer, 0, &[0]);
    }

    /// Finish the scene by letting the device know all commands are ready to be run
    pub fn finish(&mut self) {
        self.pass_encoder = None; // Drop the encoder before submitting. Equivalent to passEncoder.end()
        let encoder = self.command_encoder.take().expect("command_encoder already finished");
        self.queue.submit([encoder.finish()]);
    }

    /**
     * Setup a render pipeline
     * @param pipeline - the render pipeline
     */
    pub fn set_render_pipeline(&mut self, name: String, pipeline: &mut RenderPipeline) {
        if let Some(curr_pipeline) = &self.curr_pipeline
            && curr_pipeline == &name
        {
            return;
        }
        self.curr_pipeline = Some(name);
        let pass_encoder = &mut self.pass_encoder.as_mut().unwrap().borrow_mut();
        pass_encoder.set_pipeline(pipeline);
    }

    /**
     * Setup a compute pipeline
     * @param pipeline - the compute pipeline
     */
    pub fn set_compute_pipeline(&mut self, name: String, pipeline: &mut ComputePipeline) {
        if let Some(curr_pipeline) = &self.curr_pipeline
            && curr_pipeline == &name
        {
            return;
        }
        self.curr_pipeline = Some(name);
        self.compute_pass.as_mut().unwrap().borrow_mut().set_pipeline(pipeline);
    }

    /**
     * Set a clear color
     * @param clear_color - the clear color
     */
    pub fn set_clear_color(&mut self, clear_color: ColorArray) {
        self.clear_color_rgba = clear_color;
    }

    /**
     * Set the colorblind mode
     * @param mode - the colorblind mode
     */
    pub fn set_color_blind_mode(&mut self, mode: ColorMode) {
        if self.color_mode == mode {
            return;
        }
        self.color_mode = mode;
        let mode_floats: Vec<f32> = vec![mode as u32 as f32];
        let bytes: &[u8] = bytemuck::cast_slice(&mode_floats);
        self.queue.write_buffer(&self.view_uniform_buffer.buffer, 0, bytes);
    }

    /**
     * Set the device pixel ratio
     * @param device_pixel_ratio - the device pixel ratio
     */
    pub fn set_device_pixel_ratio(&mut self, device_pixel_ratio: Option<f32>) {
        if let Some(device_pixel_ratio) = device_pixel_ratio {
            self.device_pixel_ratio = device_pixel_ratio;
        }
        let input_slice: Vec<f32> = vec![self.device_pixel_ratio];
        let bytes: &[u8] = bytemuck::cast_slice(&input_slice);
        self.queue.write_buffer(&self.view_uniform_buffer.buffer, 15 * 4, bytes);
        todo!()
    }

    /// Build a GPU Buffer
    /// https://programmer.ink/think/several-best-practices-of-webgpu.html
    /// BEST PRACTICE 1: Use the label attribute where it can be used
    /// BEST PRACTICE 5: Buffer data upload (give priority to write_buffer() API,
    ///                  which avoids extra buffer replication operation.)
    ///
    /// ## Parameters
    /// - `label`: buffer label
    /// - `input_array`: buffer data
    /// - `in_usage`: how the buffer is used
    /// - `size`: buffer size
    ///
    /// ## Returns
    /// The WebGPU buffer
    pub fn build_gpu_buffer<T: Pod>(
        &self,
        label: &str,
        input_slice: &[T],
        in_usage: BufferUsages,
        size: Option<u64>,
    ) -> WebGPUBuffer {
        let size = size.unwrap_or(input_slice.len() as u64);
        // prep buffer
        let mut usage = in_usage | BufferUsages::COPY_DST;
        if !in_usage.contains(BufferUsages::MAP_READ) {
            usage |= BufferUsages::COPY_SRC;
        }

        let bytes: &[u8] = bytemuck::cast_slice(input_slice);

        let buf = self.device.create_buffer(&BufferDescriptor {
            label: Some(label),
            usage,
            size,
            mapped_at_creation: false,
        });

        self.queue.write_buffer(&buf, 0, bytes);

        WebGPUBuffer::new(Some(label.into()), size, usage, buf)
    }

    /**
     * Duplicate a GPU Buffer
     * @param input_buffer - the input buffer
     * @param command_encoder - the command encoder
     * @returns the duplicated buffer
     */
    pub fn duplicate_gpu_buffer(
        &self,
        input_buffer: &WebGPUBuffer,
        command_encoder: &mut CommandEncoder,
    ) -> WebGPUBuffer {
        input_buffer.clone(&self.device, command_encoder)
    }

    /**
     * Build a padded buffer
     * @param input - the input buffer
     * @param width - the width of the buffer
     * @param height - the height of the buffer
     * @returns the padded buffer
     */
    pub fn build_padded_buffer(&self, input: Vec<u8>, width: u32, height: u32) -> PaddedBuffer {
        let alignment: u32 = self.device.limits().min_uniform_buffer_offset_alignment;
        let bytes_per_row = (width * 4).div_ceil(alignment) * alignment;
        let padded_buffer_size = bytes_per_row * height;
        let mut padded_sprite_data = vec![0_u8; padded_buffer_size as usize];
        let w = width as usize;
        let h = height as usize;
        let bpr = bytes_per_row as usize;
        for y in 0..h {
            let src_start = y * w * 4;
            let src_end = src_start + (w * 4);
            let dst_start = y * bpr;
            let dst_end = dst_start + (w * 4);
            padded_sprite_data[dst_start..dst_end].copy_from_slice(&input[src_start..src_end]);
        }

        PaddedBuffer { data: padded_sprite_data, width: bytes_per_row, height }
    }

    /**
     * Get a collection of IDs pointing to the features found at the mouse position
     * @param _x - x mouse position
     * @param _y - y mouse position
     * @returns the collection of features found
     */
    pub async fn get_feature_at_mouse_position(&self, _x: u32, _y: u32) -> Vec<u32> {
        // TODO:
        //     const { device } = this;
        //     let result: number[] = [];
        //     // if we are already finding a feature, return undefined
        //     if (this.finding_feature) return result;

        //     // first read the index buffer and result buffer into the read buffer
        //     const command_encoder = device.createCommandEncoder();
        //     command_encoder.copyBufferToBuffer(
        //       this.#interactive_index_buffer,
        //       0,
        //       this.interactive_read_buffer,
        //       0,
        //       4,
        //     );
        //     command_encoder.copyBufferToBuffer(
        //       this.interactive_result_buffer,
        //       0,
        //       this.interactive_read_buffer,
        //       4,
        //       200,
        //     );
        //     device.queue.submit([command_encoder.finish()]);

        //     // read the results
        //     this.finding_feature = true;
        //     await this.interactive_read_buffer.mapAsync(GPUMapMode.READ);
        //     this.finding_feature = false;
        //     const arrayBuffer = this.interactive_read_buffer.getMappedRange();
        //     const data = new Uint32Array(arrayBuffer);
        //     // grab the index
        //     const size = data[0];
        //     // if the size is 0, we didn't hit anything; otherwise build array filtering out dublicates
        //     if (size !== 0) result = Array.from(data.slice(1, size + 1));
        //     // filter out duplicates
        //     s = [...new Set(result)];

        //     // unmap before we return the result
        //     this.interactive_read_buffer.unmap();
        //     return result;
        todo!()
    }

    /**
     * Resize the canvas and context
     * @param cb - callback function to be executed when resize is eventually called
     */
    pub fn resize(&mut self, width: u32, height: u32) {
        self.resize_next_frame = Some(Presentation { width, height, depth_or_array_layers: 1 });
    }

    /** Resize the canvas, context, and associated buffers */
    fn _resize(&mut self, width: u32, height: u32) {
        // First configure the surface
        let defaults = self
            .surface
            .get_default_config(&self.adapter, width, height)
            .unwrap_or_else(|| panic!("Failed to get default config"));
        self.surface.configure(
            &self.device,
            &SurfaceConfiguration {
                usage: TextureUsages::RENDER_ATTACHMENT,
                alpha_mode: CompositeAlphaMode::PreMultiplied,
                ..defaults
            },
        );

        self.resize_next_frame = None;
        self.presentation = Presentation { width, height, depth_or_array_layers: 1 };
        // fix the render target
        if let Some(render_target) = &self.render_target {
            render_target.destroy();
        }
        self.render_target = None;
        if self.sample_count > 1 {
            self.render_target = Some(self.device.create_texture(&TextureDescriptor {
                size: self.presentation,
                sample_count: self.sample_count,
                format: self.format,
                usage: TextureUsages::RENDER_ATTACHMENT,
                label: "Render Target".into(),
                mip_level_count: 1,
                dimension: TextureDimension::D2,
                view_formats: &[self.format],
            }));
        }
        // fix the depth-stencil
        if let Some(depth_stencil_texture) = &self.depth_stencil_texture {
            depth_stencil_texture.destroy();
        }
        self.depth_stencil_texture = None;
        self.depth_stencil_texture = Some(self.device.create_texture(&TextureDescriptor {
            size: self.presentation,
            sample_count: self.sample_count,
            format: TextureFormat::Depth24PlusStencil8,
            usage: TextureUsages::RENDER_ATTACHMENT,
            label: "Depth Stencil".into(),
            mip_level_count: 1,
            dimension: TextureDimension::D2,
            view_formats: &[TextureFormat::Depth24PlusStencil8],
        }));
        // update the device pixel ratio
        self.set_device_pixel_ratio(None);
        todo!()
    }

    /**
     * Set the interactive state
     * @param interactive - the interactive state (true means it is interactive)
     */
    pub fn set_interactive(&mut self, interactive: bool) {
        self.interactive = interactive;
    }

    /**
     * Set the projection (S2 or WM)
     * @param projection - the projection
     */
    pub fn set_projection(&mut self, projection: Projection) {
        self.projection = projection;
    }

    /**
     * Get the depth position of a layer
     * @param layerIndex - the layer index
     * @returns the depth position
     */
    pub fn get_depth_position(layer_index: u32) -> f32 {
        let depth_espilon = 1. / powf(2., 20.);
        1. - ((layer_index as f32) + 1.) * depth_espilon
    }

    /**
     * Set the stencil reference
     * @param stencil_ref - the stencil reference
     */
    pub fn set_stencil_reference(&mut self, stencil_ref: u32) {
        if self.stencil_ref == stencil_ref {
            return;
        }
        self.stencil_ref = stencil_ref;
        self.pass_encoder.as_mut().unwrap().borrow_mut().set_stencil_reference(stencil_ref);
    }

    /** Build context storage groups and layouts */
    fn _build_context_storage_groups_and_layouts(&mut self) {
        // setup a null texture
        self.null_texture = Some(self.build_texture_simple::<u8>(None, None, 1, Some(1)));
        // setup shared texture
        self.shared_texture = Some(self.build_texture_simple::<u8>(None, None, 2048, Some(200)));
        // setup interactive buffers
        self.interactive_index_buffer = self.build_gpu_buffer(
            "Interactive Index Buffer",
            &vec![0_u32],
            BufferUsages::STORAGE | BufferUsages::COPY_SRC,
            None,
        );
        self.interactive_result_buffer = self.build_gpu_buffer(
            "Interactive Result Buffer",
            &vec![0_u32; 50],
            BufferUsages::STORAGE | BufferUsages::COPY_SRC,
            None,
        );
        self.interactive_read_buffer = self.build_gpu_buffer(
            "Interactive Read Buffer",
            &vec![0_u32; 51],
            BufferUsages::COPY_DST | BufferUsages::MAP_READ,
            None,
        );
        self.interactive_bind_group_layout = Some(self.build_layout(
            "Interactive",
            vec![
                BufferBindingType::Storage { read_only: false },
                BufferBindingType::Storage { read_only: false },
            ],
            Some(ShaderStages::COMPUTE),
        ));
        self.interactive_bind_group = Some(self.build_group(
            "Interactive BindGroup",
            self.interactive_bind_group_layout.as_ref().unwrap(),
            &vec![&self.interactive_index_buffer, &self.interactive_result_buffer],
        ));
        // setup position uniforms
        self.view_uniform_buffer = self.build_gpu_buffer(
            "View Uniform Buffer",
            &vec![0.0_f32; 16],
            BufferUsages::UNIFORM,
            None,
        );
        self.matrix_uniform_buffer = self.build_gpu_buffer(
            "Matrix Uniform Buffer",
            &vec![0.0_f32; 16],
            BufferUsages::UNIFORM,
            None,
        );
        self.frame_bind_group_layout = Some(self.build_layout(
            "Frame",
            vec![BufferBindingType::Uniform, BufferBindingType::Uniform],
            Some(ShaderStages::VERTEX | ShaderStages::FRAGMENT | ShaderStages::COMPUTE),
        ));
        self.frame_buffer_bind_group = Some(self.build_group(
            "Frame BindGroup",
            self.frame_bind_group_layout.as_ref().unwrap(),
            &vec![&self.view_uniform_buffer, &self.matrix_uniform_buffer],
        ));
        // setup per feature uniforms layout
        self.feature_bind_group_layout = Some(self.build_layout(
            "Feature",
            vec![
                BufferBindingType::Uniform,
                BufferBindingType::Uniform,
                BufferBindingType::Uniform,
                BufferBindingType::Storage { read_only: true },
                BufferBindingType::Storage { read_only: true },
            ],
            Some(ShaderStages::VERTEX | ShaderStages::FRAGMENT | ShaderStages::COMPUTE),
        ));
        self.mask_pattern_bind_group_layout =
            Some(self.device.create_bind_group_layout(&BindGroupLayoutDescriptor {
                label: Some("Mask Interactive BindGroupLayout"),
                entries: &vec![
                    // pattern x,y,w,h,movement
                    BindGroupLayoutEntry {
                        binding: 4,
                        visibility: ShaderStages::VERTEX | ShaderStages::FRAGMENT,
                        ty: BindingType::Buffer {
                            ty: BufferBindingType::Uniform,
                            has_dynamic_offset: false,
                            min_binding_size: None,
                        },
                        count: None,
                    },
                    // pattern sampler
                    BindGroupLayoutEntry {
                        binding: 5,
                        visibility: ShaderStages::FRAGMENT,
                        ty: BindingType::Sampler(SamplerBindingType::Filtering),
                        count: None,
                    },
                    // pattern texture
                    BindGroupLayoutEntry {
                        binding: 6,
                        visibility: ShaderStages::VERTEX | ShaderStages::FRAGMENT,
                        ty: BindingType::Texture {
                            sample_type: TextureSampleType::Float { filterable: true },
                            view_dimension: TextureViewDimension::D2,
                            multisampled: false,
                        },
                        count: None,
                    },
                ],
            }));
        self.default_sampler = Some(self.build_sampler(FilterMode::Nearest, false, false, None));
        self.pattern_sampler = Some(self.build_sampler(FilterMode::Linear, true, true, None));
        todo!()
    }

    /**
     * Build a new sampler
     * @param filter - filter type: "linear" | "nearest"
     * @param repeatU - repeat the sampler in the U direction
     * @param repeatV - repeat the sampler in the V direction
     * @returns the new sampler
     */
    pub fn build_sampler(
        &self,
        filter: FilterMode,
        repeat_u: bool,
        repeat_v: bool,
        label: Option<&str>,
    ) -> Sampler {
        self.device.create_sampler(&SamplerDescriptor {
            label,
            address_mode_u: if repeat_u { AddressMode::Repeat } else { AddressMode::ClampToEdge },
            address_mode_v: if repeat_v { AddressMode::Repeat } else { AddressMode::ClampToEdge },
            address_mode_w: AddressMode::ClampToEdge,
            mag_filter: filter,
            min_filter: filter,
            ..Default::default()
        })
    }

    /// Simpler texture builder of [`Self::build_texture`]
    pub fn build_texture_simple<T: Pod>(
        &self,
        image_data: Option<&[T]>,
        texture_data: Option<&Texture>,
        width: u32,
        height: Option<u32>,
    ) -> Texture {
        self.build_texture(
            image_data,
            texture_data,
            width,
            height,
            None,
            None,
            None,
            None,
            None,
            None,
        )
    }

    /**
     * Build a new texture
     * @param imageData - the raw image data to inject to the texture
     * @param width - width of the texture
     * @param height - height of the texture
     * @param depth_or_array_layers - depth of the texture
     * @param src_origin - origin starting position of the source texture
     * @param dst_origin - destination starting position of the GPU texture
     * @param format - format of the texture
     * @param command_encoder - command encoder to use
     * @returns the new texture
     */
    pub fn build_texture<T: Pod>(
        &self,
        image_data: Option<&[T]>,
        texture_data: Option<&Texture>,
        width: u32,
        height: Option<u32>,
        depth_or_array_layers: Option<u32>,
        src_origin: Option<Origin3d>,
        dst_origin: Option<Origin3d>,
        format: Option<TextureFormat>, // = 'rgba8unorm',
        command_encoder: Option<&mut CommandEncoder>,
        label: Option<&str>,
    ) -> Texture {
        let height = height.unwrap_or(width);
        let depth_or_array_layers: u32 = depth_or_array_layers.unwrap_or(1);
        let format = format.unwrap_or(TextureFormat::Rgba8Unorm);
        let src_origin = src_origin.unwrap_or(Origin3d::ZERO);
        let dst_origin = dst_origin.unwrap_or(Origin3d::ZERO);
        let mut texture = self.device.create_texture(&TextureDescriptor {
            label,
            size: Extent3d { width, height, depth_or_array_layers },
            format,
            usage: TextureUsages::TEXTURE_BINDING
                | TextureUsages::COPY_SRC
                | TextureUsages::COPY_DST
                | TextureUsages::RENDER_ATTACHMENT,
            mip_level_count: 0,
            sample_count: 0,
            dimension: TextureDimension::D2,
            view_formats: &[],
        });
        // NOTE: It is assumed that the imageData's width and height are the same as the texture's width and height
        // if not, and the source is a BufferSource or SharedArrayBuffer, it will probably fail
        if let Some(image_data) = image_data {
            self.upload_texture_data(
                &mut texture,
                image_data,
                width,
                height,
                dst_origin,
                depth_or_array_layers,
                command_encoder,
            );
        } else if let Some(texture_data) = texture_data {
            self.upload_texture_to_texture_data(
                texture_data,
                &texture,
                src_origin,
                dst_origin,
                depth_or_array_layers,
                command_encoder,
            );
        }

        texture
    }

    /**
     * Upload texture data to the GPU
     * @param texture - input Texture buffer
     * @param imageData - input image data
     * @param width - width of the texture
     * @param height - height of the texture
     * @param src_origin - origin starting position of the source data
     * @param dst_origin - destination starting position of the GPU texture
     * @param depth_or_array_layers - depth of the texture
     * @param command_encoder - command encoder to use
     */
    pub fn upload_texture_data<T: Pod>(
        &self,
        texture: &Texture,
        image_data: &[T],
        width: u32,
        height: u32,
        dst_origin: Origin3d,
        depth_or_array_layers: u32,
        command_encoder: Option<&mut CommandEncoder>,
    ) {
        let mut auto;
        let encoder: &mut CommandEncoder = match command_encoder {
            Some(e) => e,
            None => {
                auto = AutoSubmitEncoder::new(
                    &self.queue,
                    Some(self.device.create_command_encoder(&Default::default())),
                );
                auto.encoder()
            }
        };

        let alignment = self.device.limits().min_uniform_buffer_offset_alignment;
        // For ArrayBufferView, use a buffer to upload
        let buffer =
            self.build_gpu_buffer("Texture Data", image_data, BufferUsages::COPY_SRC, None);
        encoder.copy_buffer_to_texture(
            TexelCopyBufferInfo {
                buffer: &buffer.buffer,
                layout: TexelCopyBufferLayout {
                    offset: 0,
                    bytes_per_row: Some(u32::max(alignment, width * 4)),
                    rows_per_image: Some(height),
                },
            },
            TexelCopyTextureInfo {
                texture,
                mip_level: 0,
                origin: dst_origin,
                aspect: TextureAspect::All,
            },
            Extent3d { width: texture.width(), height: texture.height(), depth_or_array_layers },
        );
    }

    /**
     * Upload texture data to the GPU
     * @param texture - input Texture buffer
     * @param imageData - input image data
     * @param width - width of the texture
     * @param height - height of the texture
     * @param src_origin - origin starting position of the source data
     * @param dst_origin - destination starting position of the GPU texture
     * @param depth_or_array_layers - depth of the texture
     * @param command_encoder - command encoder to use
     */
    fn upload_texture_to_texture_data(
        &self,
        from_texture: &Texture,
        to_texture: &Texture,
        src_origin: Origin3d,
        dst_origin: Origin3d,
        depth_or_array_layers: u32,
        command_encoder: Option<&mut CommandEncoder>,
    ) {
        let mut auto;
        let encoder: &mut CommandEncoder = match command_encoder {
            Some(e) => e,
            None => {
                auto = AutoSubmitEncoder::new(
                    &self.queue,
                    Some(self.device.create_command_encoder(&Default::default())),
                );
                auto.encoder()
            }
        };

        encoder.copy_texture_to_texture(
            TexelCopyTextureInfo {
                texture: from_texture,
                origin: src_origin, // flipY: true
                aspect: TextureAspect::All,
                mip_level: 0,
            },
            TexelCopyTextureInfo {
                texture: to_texture,
                origin: dst_origin,
                aspect: TextureAspect::All,
                mip_level: 0,
            },
            Extent3d {
                width: from_texture.width(),
                height: from_texture.height(),
                depth_or_array_layers,
            },
        );
    }

    /// @returns a Uint8ClampedArray of the current screen
    pub fn get_render_data(&self) -> Vec<u8> {
        let surface_tex;
        let target = match self.render_target.as_ref() {
            Some(t) => t,
            None => {
                surface_tex = self.surface.get_current_texture();
                match &surface_tex {
                    CurrentSurfaceTexture::Success(st) | CurrentSurfaceTexture::Suboptimal(st) => {
                        &st.texture
                    }
                    _ => panic!("Unable to get current texture"),
                }
            }
        };
        self.download_texture_data(target, self.presentation.width, self.presentation.height)
    }

    /**
     * Download texture data
     * @param texture - input texture
     * @param width - width of the texture to download
     * @param height - height of the texture to download
     * @returns a Uint8ClampedArray of the texture
     */
    fn download_texture_data(&self, texture: &Texture, width: u32, height: u32) -> Vec<u8> {
        let buffer = self.device.create_buffer(&BufferDescriptor {
            label: None,
            size: (width as u64) * (height as u64) * 4, // 4 bytes per pixel (RGBA)
            usage: BufferUsages::COPY_DST | BufferUsages::MAP_READ,
            mapped_at_creation: false,
        });

        // Create a command encoder
        let mut command_encoder =
            self.device.create_command_encoder(&CommandEncoderDescriptor { label: None });

        // TODO:
        // Copy the texture to the buffer
        // command_encoder.copy_texture_to_buffer(
        //       { texture },
        //       { buffer, bytes_per_row: width * 4 },
        //       { width, height, depth_or_array_layers: 1 },
        // );

        //     // Submit the commands to the GPU
        //     const gpuCommands = command_encoder.finish();
        //     device.queue.submit([gpuCommands]);

        //     // Wait for the GPU to finish executing the commands
        //     await buffer.mapAsync(GPUMapMode.READ);

        //     // Create a new Uint8ClampedArray view of the buffer's contents
        //     const arrayBuffer = buffer.getMappedRange();
        //     const data = new Uint8ClampedArray(arrayBuffer);

        //     // Create a copy of the data to return
        //     const result = new Uint8ClampedArray(data);
        //     // Unmap the buffer
        //     buffer.unmap();

        //     return result;
        todo!()
    }

    /**
     * Build a new layout
     * https://programmer.ink/think/several-best-practices-of-webgpu.html
     * BEST PRACTICE 7: shared resource binding group and binding group layout object
     * @param name - layout name
     * @param bindings - layout bindings
     * @param visibility - layout visibility
     * @returns a new bind group layout
     */
    pub fn build_layout(
        &self,
        name: &str,
        bindings: Vec<BufferBindingType>,
        visibility: Option<ShaderStages>,
    ) -> BindGroupLayout {
        let label = format!("{} BindGroupLayout", name);
        let visibility = visibility.unwrap_or(ShaderStages::VERTEX);
        self.device.create_bind_group_layout(&BindGroupLayoutDescriptor {
            label: Some(&label),
            entries: &bindings
                .into_iter()
                .enumerate()
                .map(|(index, r#type)| BindGroupLayoutEntry {
                    binding: index as u32,
                    visibility,
                    ty: BindingType::Buffer {
                        ty: r#type,
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                })
                .collect::<Vec<_>>(),
        })
    }

    /**
     * Build a new bind group
     * @param name - bind group name
     * @param layout - bind group layout
     * @param bindings - bind group bindings
     * @returns a new bind group
     */
    pub fn build_group(
        &self,
        name: &str,
        layout: &BindGroupLayout,
        bindings: &[&WebGPUBuffer],
    ) -> BindGroup {
        self.device.create_bind_group(&BindGroupDescriptor {
            label: Some(&format!("{} BindGroup", name)),
            layout,
            entries: &bindings
                .into_iter()
                .enumerate()
                .map(|(index, buffer)| BindGroupEntry {
                    binding: index as u32,
                    resource: BindingResource::Buffer(BufferBinding {
                        buffer: &buffer.buffer,
                        offset: 0,
                        size: None,
                    }),
                })
                .collect::<Vec<_>>(),
        })
    }

    /// Inject a glyph/icon image to the GPU
    ///
    /// ## Parameters
    /// - `max_height`: the maximum height of the texture
    /// - `images`: the glyph/icon images
    ///
    /// ## Returns
    /// true if the texture that stores the data was resized
    pub fn inject_images(&mut self, max_height: u32, images: GlyphImages) -> bool {
        // first increase texture size if needed
        let resized = self._increase_texture_size(max_height);
        // setup a command encoder to upload images all in one go
        let mut c_e = self.device.create_command_encoder(&CommandEncoderDescriptor::default());
        // upload each image to texture
        for GlyphImage { pos_x, pos_y, width, height, data } in images {
            // first make sure width is a multiple of 256
            let padded_data = self.build_padded_buffer(data, width, height);
            self.upload_texture_data(
                self.shared_texture.as_ref().unwrap(),
                &padded_data.data,
                width,
                height,
                Origin3d { x: pos_x, y: pos_y, z: 0 },
                1,
                Some(&mut c_e),
            );
        }
        self.queue.submit([c_e.finish()]);

        resized
    }

    /**
     * Inject a sprite image
     * @param message - the sprite image message containing the raw image data and it's shape
     * @returns true if the texture that stores the data was resized
     */
    pub fn inject_sprite_image(&mut self, message: SpriteImageMessage) -> bool {
        let SpriteImageMessage { image, offset_x, offset_y, width, height, max_height, .. } =
            message;
        // first increase texture size if needed
        let resized = self._increase_texture_size(max_height);
        // then update texture
        self.upload_texture_data(
            self.shared_texture.as_ref().unwrap(),
            &image.data,
            width,
            height,
            Origin3d { x: offset_x, y: offset_y, z: 0 },
            1,
            None,
        );

        resized
    }

    /**
     * Increase a texture's size
     * @param new_height - the new height for the texture
     * @returns true if the texture was resized
     */
    fn _increase_texture_size(&mut self, new_height: u32) -> bool {
        let shared_texture = self.shared_texture.as_ref().unwrap();
        if new_height <= shared_texture.height() {
            return false;
        }
        let new_texture = self.build_texture_simple::<u8>(
            None,
            Some(&shared_texture),
            shared_texture.width(),
            Some(new_height),
        );
        shared_texture.destroy();
        self.shared_texture = Some(new_texture);

        true
    }

    /**
     * Build a new pattern bind group
     * @param fill_texture_positions - the fill texture positions
     * @param texture - the texture to bind
     * @returns a new pattern bind group
     */
    pub fn create_pattern_bind_group(
        &self,
        fill_texture_positions: &WebGPUBuffer,
        texture: Option<&Texture>, // = this.shared_texture,
        label: Option<&str>,
    ) -> BindGroup {
        let texture = texture.unwrap_or(self.shared_texture.as_ref().unwrap());
        self.device.create_bind_group(&BindGroupDescriptor {
            label: label.or(Some("Fill Pattern BindGroup")),
            layout: self.mask_pattern_bind_group_layout.as_ref().unwrap(),
            entries: &[
                BindGroupEntry {
                    binding: 4,
                    resource: BindingResource::Buffer(BufferBinding {
                        buffer: &fill_texture_positions.buffer,
                        offset: 0,
                        size: None,
                    }),
                },
                BindGroupEntry {
                    binding: 5,
                    resource: BindingResource::Sampler(self.pattern_sampler.as_ref().unwrap()),
                },
                BindGroupEntry {
                    binding: 6,
                    resource: BindingResource::TextureView(
                        &texture.create_view(&TextureViewDescriptor::default()),
                    ),
                },
            ],
        })
    }
}

/// GPU context container
pub type GPUContextContainer = (Adapter, Device, Queue, Surface<'static>);

/// Setup a GPU context Container
pub async fn create_gpu_context(window: &winit::window::Window) -> GPUContextContainer {
    // 1. Instance - The entry point for wgpu
    let instance = wgpu::Instance::new(wgpu::InstanceDescriptor::new_without_display_handle());
    // 2. Surface - The connection to your window
    let surface = unsafe {
        core::mem::transmute::<Surface<'_>, Surface<'static>>(
            instance.create_surface(&window).unwrap(),
        )
    };
    // 3. Adapter - The actual physical GPU handle
    let adapter = instance
        .request_adapter(&RequestAdapterOptions {
            power_preference: PowerPreference::HighPerformance,
            compatible_surface: Some(&surface),
            force_fallback_adapter: false,
            apply_limit_buckets: false,
        })
        .await
        .expect("Failed to find an appropriate adapter");
    // 4. Device & Queue - The logical connection and the command stream
    let (device, queue) = adapter
        .request_device(&DeviceDescriptor {
            label: None,
            required_features: Features::empty(),
            // Use downlevel limits if you want OpenGL/WebGL support.
            required_limits: if cfg!(target_arch = "wasm32") {
                Limits::downlevel_webgl2_defaults()
            } else {
                Limits::default()
            },
            memory_hints: Default::default(),
            experimental_features: ExperimentalFeatures::disabled(),
            trace: Trace::Off,
        })
        .await
        .expect("Failed to create device");

    (adapter, device, queue, surface)
}

struct AutoSubmitEncoder<'a> {
    queue: &'a Queue,
    encoder: Option<CommandEncoder>,
}
impl<'a> AutoSubmitEncoder<'a> {
    fn new(queue: &'a Queue, encoder: Option<CommandEncoder>) -> Self {
        Self { queue, encoder }
    }

    fn encoder(&mut self) -> &mut CommandEncoder {
        self.encoder.as_mut().unwrap()
    }
}
impl Drop for AutoSubmitEncoder<'_> {
    fn drop(&mut self) {
        if let Some(encoder) = self.encoder.take() {
            self.queue.submit([encoder.finish()]);
        }
    }
}
