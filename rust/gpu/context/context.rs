// import buildMask from './buildMask.js';

// import type { ColorArray } from 'style/color/index.js';
// import type { ColorMode } from 's2/s2Map.js';
// import type { GlyphImages } from 'workers/source/glyphSource.js';
// import type { MapOptions } from 'ui/s2mapUI.js';
// import type { Painter } from 'gpu/painter.spec.js';
// import type { SpriteImageMessage } from 'workers/worker.spec.js';
// import type { Tile } from 'source/tile.spec.js';
// import type { GPUType, Projection } from 'style/style.spec.js';
// import type { MaskSource, TileMaskSource } from 'gpu/workflows/workflow.spec.js';

use crate::{
    gpu::{MaskSource, Painter},
    s2map::ColorMode,
    style::{ColorArray, GPUType, Projection},
    ui::MapOptions,
    workers::{GlyphImages, SpriteImageMessage},
};
use alloc::{collections::BTreeMap, rc::Rc, vec::Vec};
use bytemuck::Pod;
use core::cell::RefCell;
use libm::powf;
use wgpu::{
    Backends, DeviceDescriptor, ExperimentalFeatures, Features, Instance, Limits,
    RequestAdapterOptions,
};

/// Get the default blend state for this context
pub fn default_blend() -> wgpu::BlendState {
    wgpu::BlendState {
        color: wgpu::BlendComponent {
            src_factor: wgpu::BlendFactor::One,
            dst_factor: wgpu::BlendFactor::OneMinusSrcAlpha,
            operation: wgpu::BlendOperation::Add,
        },
        alpha: wgpu::BlendComponent {
            src_factor: wgpu::BlendFactor::One,
            dst_factor: wgpu::BlendFactor::OneMinusSrcAlpha,
            operation: wgpu::BlendOperation::Add,
        },
    }
}

/// A Presentation guideline
#[derive(Debug, Default, Clone, Copy, PartialEq)]
#[allow(missing_docs)]
pub struct Presentation {
    pub width: u32,
    pub height: u32,
    pub depth_or_array_layers: u32,
}
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
    pub usage: wgpu::BufferUsages,
    pub buffer: wgpu::Buffer,
}
impl WebGPUBuffer {
    /// Create a new buffer wrapper
    pub fn new(
        label: Option<String>,
        size: u64,
        usage: wgpu::BufferUsages,
        buffer: wgpu::Buffer,
    ) -> Self {
        Self { label, size, usage, buffer }
    }
    /// Clone the buffer ensuring the GPU also has the copy
    pub fn clone(&self, device: &wgpu::Device, command_encoder: &mut wgpu::CommandEncoder) -> Self {
        let dst = device.create_buffer(&wgpu::BufferDescriptor {
            label: self.label.as_deref(),
            size: self.size,
            usage: self.usage,
            mapped_at_creation: false,
        });

        command_encoder.copy_buffer_to_buffer(&self.buffer, 0, &dst, 0, self.size);

        Self { label: self.label.clone(), size: self.size, usage: self.usage, buffer: dst }
    }
}

/// # WebGPU Context
///
/// Wrapper to manage state and GPU calls for a WebGPU context
#[derive(Debug)]
#[allow(missing_docs)]
pub struct WebGPUContext {
    pub ready: bool, // false
    // constants/semi-constants
    pub r#type: GPUType,  // = 3; // specifying that we are using a WebGPUContext
    pub renderer: String, // ex: AMD Radeon Pro 560 OpenGL Engine (https://github.com/pmndrs/detect-gpu)
    pub gpu: wgpu::Surface<'static>, // GPUCanvasContext,
    pub device: wgpu::Device,
    pub queue: wgpu::Queue,
    pub presentation: Presentation,
    pub painter: Rc<RefCell<Painter>>,
    //   #adapter!: GPUAdapter; (dont need this)
    pub device_pixel_ratio: f32,
    pub interactive: bool,           // = false;
    pub projection: Projection,      // = 'S2';
    pub format: wgpu::TextureFormat, // GPUTextureFormat = 'rgba8unorm';
    pub masks: BTreeMap<u32, MaskSource>,
    pub sample_count: u32,            // = 1;
    pub clear_color_rgba: ColorArray, // = [0, 0, 0, 0];
    // manage buffers, layouts, and bind groups
    pub null_texture: wgpu::Texture,
    pub shared_texture: wgpu::Texture,
    interactive_read_buffer: WebGPUBuffer,
    interactive_index_buffer: WebGPUBuffer,
    interactive_result_buffer: WebGPUBuffer,
    pub interactive_bind_group_layout: wgpu::BindGroupLayout,
    pub interactive_bind_group: wgpu::BindGroup,
    pub mask_pattern_bind_group_layout: wgpu::BindGroupLayout,
    pub default_sampler: wgpu::Sampler,
    pub pattern_sampler: wgpu::Sampler,
    view_uniform_buffer: WebGPUBuffer,
    matrix_uniform_buffer: WebGPUBuffer,
    pub frame_bind_group_layout: wgpu::BindGroupLayout, // wgpu::BindGroupLayout,
    pub feature_bind_group_layout: wgpu::BindGroupLayout,
    pub frame_buffer_bind_group: wgpu::BindGroup,
    render_target: Option<wgpu::Texture>,
    depth_stencil_texture: wgpu::Texture,
    // frame specific variables
    pub command_encoder: Option<wgpu::CommandEncoder>, // GPUCommandEncoder;
    pub pass_encoder: Option<RefCell<wgpu::RenderPass<'static>>>, // !: GPURenderPassEncoder;
    pub compute_pass: Option<RefCell<wgpu::ComputePass<'static>>>, // GPUComputePassEncoder;
    // pub compute_pass: wgpu::ComputePass,
    resize_next_frame: bool, // = false;
    // track current states
    pub color_mode: ColorMode, // ColorMode = 0;
    pub stencil_ref: u32,      // = -1;
    pub curr_pipeline: Option<String>,
    pub finding_feature: bool, // = false;
}
impl WebGPUContext {
    /**
     * @param context - The WebGPU context
     * @param options - map options
     * @param painter - The painter that will use this context to manage rendering state
     */
    pub fn new(window: &winit::window::Window, options: &MapOptions) -> Self {
        //     const { canvas_multiplier } = options;
        //     this.gpu = context;
        //     this.device_pixel_ratio = canvas_multiplier ?? 1;
        //     this.painter = painter;
        todo!()
    }

    //   /** A setup method to connect to the GPU and prepare the context */
    //   async connect_gpu(): Promise<void> {
    //     // grab physical device adapter and device
    //     const adapter = await navigator.gpu.requestAdapter();
    //     if (adapter === null) throw new Error('Failed to get GPU adapter');
    //     this.#adapter = adapter;
    //     const device = (this.device = await this.#adapter.requestDevice());
    //     // configure context
    //     const format = (this.format = navigator.gpu.getPreferredCanvasFormat());
    //     this.gpu.configure({ device, format, alphaMode: 'premultiplied' });
    //     // prep uniform/storage buffers
    //     this.#buildContextStorageGroupsAndLayouts();
    //     // set size
    //     this.#resize();
    //     // update state
    //     this.ready = true;
    //   }

    //   /**
    //    * @param view - the view matrix
    //    * @param matrix - the projection matrix
    //    */
    //   newScene(view: Float32Array, matrix: Float32Array): void {
    //     // reset current pipeline
    //     this.curr_pipeline = undefined;
    //     // reset stencil ref
    //     this.stencil_ref = -1;
    //     // if a resize was called, let's do that first
    //     if (this.#resize_next_frame) this.#resize();
    //     // prepare descriptor
    //     this.#prepareRenderpassDescriptor();
    //     // set encoders
    //     this.command_encoder = this.device.createCommandEncoder();
    //     this.pass_encoder = this.command_encoder.beginRenderPass(this.#renderPassDescriptor);

    //     // setup view and matrix uniforms immediately
    //     this.device.queue.writeBuffer(this.#matrix_uniform_buffer, 0, matrix);
    //     this.device.queue.writeBuffer(this.view_uniform_buffer, 4, view);

    //     // setup bind groups
    //     this.pass_encoder.setBindGroup(0, this.frame_buffer_bind_group);
    //   }

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
    pub fn set_render_pipeline(&mut self, name: String, pipeline: &mut wgpu::RenderPipeline) {
        if let Some(curr_pipeline) = &self.curr_pipeline
            && curr_pipeline == &name
        {
            return;
        }
        self.curr_pipeline = Some(name);
        // this.pass_encoder.setPipeline(pipeline);
        todo!()
    }

    /**
     * Setup a compute pipeline
     * @param pipeline - the compute pipeline
     */
    pub fn set_compute_pipeline(&mut self, name: String, pipeline: &mut wgpu::ComputePipeline) {
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

    /**
     * Build a GPU Buffer
     * https://programmer.ink/think/several-best-practices-of-webgpu.html
     * BEST PRACTICE 1: Use the label attribute where it can be used
     * BEST PRACTICE 5: Buffer data upload (give priority to writeBuffer() API,
     *                  which avoids extra buffer replication operation.)
     * @param label - buffer label
     * @param input_array - buffer data
     * @param in_usage - how the buffer is used
     * @param size - buffer size
     * @returns the WebGPU buffer
     */
    pub fn build_gpu_buffer<T: Pod>(
        &self,
        label: &str,
        input_slice: &[T],
        in_usage: wgpu::BufferUsages,
        size: Option<u64>,
    ) -> WebGPUBuffer {
        let size = size.unwrap_or(input_slice.len() as u64);
        // prep buffer
        let mut usage = in_usage | wgpu::BufferUsages::COPY_DST;
        if !in_usage.contains(wgpu::BufferUsages::MAP_READ) {
            usage |= wgpu::BufferUsages::COPY_SRC;
        }

        let bytes: &[u8] = bytemuck::cast_slice(input_slice);

        let buf = self.device.create_buffer(&wgpu::BufferDescriptor {
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
        command_encoder: &mut wgpu::CommandEncoder,
    ) -> WebGPUBuffer {
        input_buffer.clone(&self.device, command_encoder)
    }

    //   /**
    //    * Build a padded buffer
    //    * @param input - the input buffer
    //    * @param width - the width of the buffer
    //    * @param height - the height of the buffer
    //    * @returns the padded buffer
    //    */
    //   build_padded_buffer(input: ArrayBuffer, width: number, height: number): PaddedBuffer {
    //     const alignment = this.device.limits.minUniformBufferOffsetAlignment;
    //     const bytesPerRow = Math.ceil((width * 4) / alignment) * alignment;
    //     const paddedBufferSize = bytesPerRow * height;
    //     const paddedSpriteData = new Uint8Array(paddedBufferSize);
    //     for (let y = 0; y < height; y++) {
    //       paddedSpriteData.set(new Uint8Array(input, y * width * 4, width * 4), y * bytesPerRow);
    //     }

    //     return {
    //       data: paddedSpriteData,
    //       width: bytesPerRow,
    //       height,
    //     };
    //   }

    //   /**
    //    * Get a collection of IDs pointing to the features found at the mouse position
    //    * @param _x - x mouse position
    //    * @param _y - y mouse position
    //    * @returns the collection of features found
    //    */
    //   async getFeatureAtMousePosition(_x: number, _y: number): Promise<number[]> {
    //     const { device } = this;
    //     let result: number[] = [];
    //     // if we are already finding a feature, return undefined
    //     if (this.finding_feature) return result;

    //     // first read the index buffer and result buffer into the read buffer
    //     const command_encoder = device.createCommandEncoder();
    //     command_encoder.copyBufferToBuffer(
    //       this.#interactive_index_buffer,
    //       0,
    //       this.#interactive_read_buffer,
    //       0,
    //       4,
    //     );
    //     command_encoder.copyBufferToBuffer(
    //       this.#interactive_result_buffer,
    //       0,
    //       this.#interactive_read_buffer,
    //       4,
    //       200,
    //     );
    //     device.queue.submit([command_encoder.finish()]);

    //     // read the results
    //     this.finding_feature = true;
    //     await this.#interactive_read_buffer.mapAsync(GPUMapMode.READ);
    //     this.finding_feature = false;
    //     const arrayBuffer = this.#interactive_read_buffer.getMappedRange();
    //     const data = new Uint32Array(arrayBuffer);
    //     // grab the index
    //     const size = data[0];
    //     // if the size is 0, we didn't hit anything; otherwise build array filtering out dublicates
    //     if (size !== 0) result = Array.from(data.slice(1, size + 1));
    //     // filter out duplicates
    //     result = [...new Set(result)];

    //     // unmap before we return the result
    //     this.#interactive_read_buffer.unmap();
    //     return result;
    //   }

    /**
     * Resize the canvas and context
     * @param cb - callback function to be executed when resize is eventually called
     */
    pub fn resize(&mut self) {
        self.resize_next_frame = true;
    }

    //   /** Resize the canvas, context, and associated buffers */
    //   fn _resize(): void {
    //     this.#resize_next_frame = false;
    //     const { gpu, sample_count } = this;
    //     const { width, height } = gpu.canvas;
    //     this.presentation = { width, height, depth_or_array_layers: 1 };
    //     // fix the render target
    //     if (render_target !== undefined) render_target.destroy();
    //     if (sample_count > 1) {
    //       render_target = this.device.createTexture({
    //         size: this.presentation,
    //         sample_count,
    //         format: this.format,
    //         usage: GPUTextureUsage.RENDER_ATTACHMENT,
    //       });
    //     }
    //     // fix the depth-stencil
    //     if (thisdepth_stencil_texture !== undefined) thisdepth_stencil_texture.destroy();
    //     thisdepth_stencil_texture = this.device.createTexture({
    //       size: this.presentation,
    //       sample_count,
    //       format: 'depth24plus-stencil8',
    //       usage: GPUTextureUsage.RENDER_ATTACHMENT,
    //     });
    //     // if #resize_cb is defined, call it
    //     if (this.#resize_cb !== undefined) {
    //       this.#resize_cb();
    //       this.#resize_cb = undefined;
    //     }
    //     // update the device pixel ratio
    //     this.set_device_pixel_ratio();
    //   }

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

    //   /**
    //    * Get the mask for a tile
    //    * the zoom determines the number of divisions necessary to maintain a visually
    //    * asthetic spherical shape. As we zoom in, the tiles are practically flat,
    //    * so division is less useful.
    //    * 0, 1 => 16  ;  2, 3 => 8  ;  4, 5 => 4  ;  6, 7 => 2  ;  8+ => 1
    //    * context stores masks so we don't keep recreating them and put excess stress and memory on the GPU
    //    * @param division - number of division to slice the geometry by
    //    * @param tile - the tile to create the mask for
    //    * @returns the mask
    //    */
    //   getMask(division: number, tile: Tile): TileMaskSource {
    //     const { masks, null_texture } = this;
    //     // check if we have a mask for this level
    //     let mask = masks.get(division);
    //     if (mask === undefined) {
    //       mask = buildMask(division, this);
    //       masks.set(division, mask);
    //     }

    //     // tile binding
    //     const uniformBuffer = this.build_gpu_buffer(
    //       'Tile Uniform Buffer',
    //       new Float32Array(tile.uniforms),
    //       GPUBufferUsage.UNIFORM,
    //     );
    //     const positionBuffer = this.build_gpu_buffer(
    //       'Tile Position Buffer',
    //       tile.bottomTop,
    //       GPUBufferUsage.UNIFORM,
    //     );
    //     // layer binding
    //     const layerBuffer = this.build_gpu_buffer(
    //       'Layer Uniform Buffer',
    //       new Float32Array([1, 0]),
    //       GPUBufferUsage.UNIFORM,
    //     );
    //     const layerCodeBuffer = this.build_gpu_buffer(
    //       'Layer Code Buffer',
    //       new Float32Array([0]),
    //       GPUBufferUsage.STORAGE,
    //     );
    //     // feature binding
    //     const featureCodeBuffer = this.build_gpu_buffer(
    //       'Feature Code Buffer',
    //       new Float32Array([0]),
    //       GPUBufferUsage.STORAGE,
    //     );
    //     // store the group
    //     const bindGroup = this.build_group('Feature BindGroup', this.feature_bind_group_layout, [
    //       uniformBuffer,
    //       positionBuffer,
    //       layerBuffer,
    //       layerCodeBuffer,
    //       featureCodeBuffer,
    //     ]);
    //     // pattern binding
    //     const fill_texture_positions = this.build_gpu_buffer(
    //       'Fill Texture Positions',
    //       new Float32Array([0, 0, 0, 0, 0]),
    //       GPUBufferUsage.UNIFORM,
    //     );
    //     // create the mask, copying the shape of other draw/workflow structures
    //     const tileMaskSource: TileMaskSource = {
    //       ...mask,
    //       bindGroup,
    //       uniformBuffer,
    //       positionBuffer,
    //       fillPatternBindGroup: this.create_pattern_bind_group(fill_texture_positions, null_texture),
    //       /** Draw the mask */
    //       draw: (): void => {
    //         this.set_stencil_reference(tile.tmpMaskID);
    //         this.painter.workflows.fill?.drawMask(tileMaskSource);
    //       },
    //       /** Destroy the mask */
    //       destroy: () => {
    //         uniformBuffer.destroy();
    //         positionBuffer.destroy();
    //         layerBuffer.destroy();
    //         layerCodeBuffer.destroy();
    //         featureCodeBuffer.destroy();
    //         fill_texture_positions.destroy();
    //       },
    //     };

    //     return tileMaskSource;
    //   }

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
        // self.pass_encoder.as_mut().unwrap().set_stencil_reference(stencil_ref);
        self.pass_encoder.as_mut().unwrap().borrow_mut().set_stencil_reference(stencil_ref);
    }

    //   /** Prepare the render pass descriptor for the next frame */
    //   #prepareRenderpassDescriptor(): void {
    //     const [r, g, b, a] = this.clear_color_rgba;
    //     const currentTexture = this.gpu.getCurrentTexture();
    //     // Create our render pass descriptor
    //     this.#renderPassDescriptor = {
    //       colorAttachments: [
    //         {
    //           view: (render_target ?? currentTexture).createView(), // set on each render pass
    //           resolveTarget: render_target !== undefined ? currentTexture.createView() : undefined,
    //           clearValue: { r, g, b, a },
    //           loadOp: 'clear',
    //           storeOp: 'store',
    //         },
    //       ],
    //       depthStencilAttachment: {
    //         view: thisdepth_stencil_texture.createView(),
    //         depthClearValue: 1.0,
    //         stencilClearValue: 0,
    //         depthLoadOp: 'clear',
    //         depthStoreOp: 'store',
    //         stencilLoadOp: 'clear',
    //         stencilStoreOp: 'store',
    //       },
    //     };
    //   }

    //   /** Build context storage groups and layouts */
    //   #buildContextStorageGroupsAndLayouts(): void {
    //     // setup a null texture
    //     this.null_texture = this.build_texture(null, 1, 1);
    //     // setup shared texture
    //     this.shared_texture = this.build_texture(null, 2048, 200);
    //     // setup interactive buffers
    //     this.#interactive_index_buffer = this.build_gpu_buffer(
    //       'Interactive Index Buffer',
    //       new Uint32Array(1),
    //       GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    //     );
    //     this.#interactive_result_buffer = this.build_gpu_buffer(
    //       'Interactive Result Buffer',
    //       new Uint32Array(50),
    //       GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    //     );
    //     this.#interactive_read_buffer = this.build_gpu_buffer(
    //       'Interactive Read Buffer',
    //       new Uint32Array(51),
    //       GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    //     );
    //     this.interactive_bind_group_layout = this.buildLayout(
    //       'Interactive',
    //       ['storage', 'storage'],
    //       GPUShaderStage.COMPUTE,
    //     );
    //     this.interactive_bind_group = this.build_group(
    //       'Interactive BindGroup',
    //       this.interactive_bind_group_layout,
    //       [this.#interactive_index_buffer, this.#interactive_result_buffer],
    //     );
    //     // setup position uniforms
    //     this.view_uniform_buffer = this.build_gpu_buffer(
    //       'View Uniform Buffer',
    //       new Float32Array(16),
    //       GPUBufferUsage.UNIFORM,
    //     );
    //     this.#matrix_uniform_buffer = this.build_gpu_buffer(
    //       'Matrix Uniform Buffer',
    //       new Float32Array(16),
    //       GPUBufferUsage.UNIFORM,
    //     );
    //     this.frame_bind_group_layout = this.buildLayout(
    //       'Frame',
    //       ['uniform', 'uniform'],
    //       GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
    //     );
    //     this.frame_buffer_bind_group = this.build_group('Frame BindGroup', this.frame_bind_group_layout, [
    //       this.view_uniform_buffer,
    //       this.#matrix_uniform_buffer,
    //     ]);
    //     // setup per feature uniforms layout
    //     this.feature_bind_group_layout = this.buildLayout(
    //       'Feature',
    //       ['uniform', 'uniform', 'uniform', 'read-only-storage', 'read-only-storage'],
    //       GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
    //     );
    //     this.mask_pattern_bind_group_layout = this.device.createBindGroupLayout({
    //       label: 'Mask Interactive BindGroupLayout',
    //       entries: [
    //         {
    //           binding: 4,
    //           visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
    //           buffer: { type: 'uniform' },
    //         }, // pattern x,y,w,h,movement
    //         { binding: 5, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } }, // pattern sampler
    //         {
    //           binding: 6,
    //           visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
    //           texture: { sampleType: 'float' },
    //         }, // pattern texture
    //       ],
    //     });
    //     this.default_sampler = this.build_sampler();
    //     this.pattern_sampler = this.build_sampler('linear', true, true);
    //   }

    /**
     * Build a new sampler
     * @param filter - filter type: "linear" | "nearest"
     * @param repeatU - repeat the sampler in the U direction
     * @param repeatV - repeat the sampler in the V direction
     * @returns the new sampler
     */
    pub fn build_sampler(
        &self,
        filter: wgpu::FilterMode,
        repeat_u: bool,
        repeat_v: bool,
        label: Option<&str>,
    ) -> wgpu::Sampler {
        self.device.create_sampler(&wgpu::SamplerDescriptor {
            label,
            address_mode_u: if repeat_u {
                wgpu::AddressMode::Repeat
            } else {
                wgpu::AddressMode::ClampToEdge
            },
            address_mode_v: if repeat_v {
                wgpu::AddressMode::Repeat
            } else {
                wgpu::AddressMode::ClampToEdge
            },
            address_mode_w: wgpu::AddressMode::ClampToEdge,
            mag_filter: filter,
            min_filter: filter,
            ..Default::default()
        })
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
        texture_data: Option<&wgpu::Texture>,
        width: u32,
        height: Option<u32>,
        depth_or_array_layers: Option<u32>,
        src_origin: Option<wgpu::Origin3d>,
        dst_origin: Option<wgpu::Origin3d>,
        format: Option<wgpu::TextureFormat>, // = 'rgba8unorm',
        command_encoder: Option<&mut wgpu::CommandEncoder>,
        label: Option<&str>,
    ) -> wgpu::Texture {
        let height = height.unwrap_or(width);
        let depth_or_array_layers: u32 = depth_or_array_layers.unwrap_or(1);
        let format = format.unwrap_or(wgpu::TextureFormat::Rgba8Unorm);
        let src_origin = src_origin.unwrap_or(wgpu::Origin3d::ZERO);
        let dst_origin = dst_origin.unwrap_or(wgpu::Origin3d::ZERO);
        let mut texture = self.device.create_texture(&wgpu::TextureDescriptor {
            label,
            size: wgpu::Extent3d { width, height, depth_or_array_layers },
            format,
            usage: wgpu::TextureUsages::TEXTURE_BINDING
                | wgpu::TextureUsages::COPY_SRC
                | wgpu::TextureUsages::COPY_DST
                | wgpu::TextureUsages::RENDER_ATTACHMENT,
            mip_level_count: 0,
            sample_count: 0,
            dimension: wgpu::TextureDimension::D2,
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
        texture: &wgpu::Texture,
        image_data: &[T],
        width: u32,
        height: u32,
        dst_origin: wgpu::Origin3d,
        depth_or_array_layers: u32,
        command_encoder: Option<&mut wgpu::CommandEncoder>,
    ) {
        let mut auto;
        let encoder: &mut wgpu::CommandEncoder = match command_encoder {
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
            self.build_gpu_buffer("Texture Data", image_data, wgpu::BufferUsages::COPY_SRC, None);
        encoder.copy_buffer_to_texture(
            wgpu::TexelCopyBufferInfo {
                buffer: &buffer.buffer,
                layout: wgpu::TexelCopyBufferLayout {
                    offset: 0,
                    bytes_per_row: Some(u32::max(alignment, width * 4)),
                    rows_per_image: Some(height),
                },
            },
            wgpu::TexelCopyTextureInfo {
                texture,
                mip_level: 0,
                origin: dst_origin,
                aspect: wgpu::TextureAspect::All,
            },
            wgpu::Extent3d {
                width: texture.width(),
                height: texture.height(),
                depth_or_array_layers,
            },
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
        from_texture: &wgpu::Texture,
        to_texture: &wgpu::Texture,
        src_origin: wgpu::Origin3d,
        dst_origin: wgpu::Origin3d,
        depth_or_array_layers: u32,
        command_encoder: Option<&mut wgpu::CommandEncoder>,
    ) {
        let mut auto;
        let encoder: &mut wgpu::CommandEncoder = match command_encoder {
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
            wgpu::TexelCopyTextureInfo {
                texture: from_texture,
                origin: src_origin, // flipY: true
                aspect: wgpu::TextureAspect::All,
                mip_level: 0,
            },
            wgpu::TexelCopyTextureInfo {
                texture: to_texture,
                origin: dst_origin,
                aspect: wgpu::TextureAspect::All,
                mip_level: 0,
            },
            wgpu::Extent3d {
                width: from_texture.width(),
                height: from_texture.height(),
                depth_or_array_layers,
            },
        );
    }

    /// @returns a Uint8ClampedArray of the current screen
    pub fn get_render_data(&self) -> Vec<u8> {
        let surface;
        let target = match self.render_target.as_ref() {
            Some(t) => t,
            None => {
                surface = self.gpu.get_current_texture().unwrap();
                &surface.texture
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
    fn download_texture_data(&self, texture: &wgpu::Texture, width: u32, height: u32) -> Vec<u8> {
        //     const { device } = this;
        // Create a buffer to store the read data
        //     const buffer = device.createBuffer({
        //       size: width * height * 4, // 4 bytes per pixel (RGBA)
        //       usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
        //     });
        let buffer = self.device.create_buffer(&wgpu::BufferDescriptor {
            label: None,
            size: (width as u64) * (height as u64) * 4, // 4 bytes per pixel (RGBA)
            usage: wgpu::BufferUsages::COPY_DST | wgpu::BufferUsages::MAP_READ,
            mapped_at_creation: false,
        });

        // Create a command encoder
        let mut command_encoder =
            self.device.create_command_encoder(&wgpu::CommandEncoderDescriptor { label: None });

        // Copy the texture to the buffer
        // command_encoder.copy_texture_to_buffer(
        //       { texture },
        //       { buffer, bytesPerRow: width * 4 },
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
        bindings: Vec<wgpu::BufferBindingType>,
        visibility: Option<wgpu::ShaderStages>,
    ) -> wgpu::BindGroupLayout {
        let label = format!("{} BindGroupLayout", name);
        let visibility = visibility.unwrap_or(wgpu::ShaderStages::VERTEX);
        self.device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some(&label),
            entries: &bindings
                .into_iter()
                .enumerate()
                .map(|(index, r#type)| wgpu::BindGroupLayoutEntry {
                    binding: index as u32,
                    visibility,
                    ty: wgpu::BindingType::Buffer {
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
        layout: &wgpu::BindGroupLayout,
        bindings: &[&WebGPUBuffer],
    ) -> wgpu::BindGroup {
        self.device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some(&format!("{} BindGroup", name)),
            layout,
            entries: &bindings
                .into_iter()
                .enumerate()
                .map(|(index, buffer)| wgpu::BindGroupEntry {
                    binding: index as u32,
                    resource: wgpu::BindingResource::Buffer(wgpu::BufferBinding {
                        buffer: &buffer.buffer,
                        offset: 0,
                        size: None,
                    }),
                })
                .collect::<Vec<_>>(),
        })
    }

    /**
     * Inject a glyph/icon image to the GPU
     * @param max_height - the maximum height of the texture
     * @param images - the glyph/icon images
     * @returns true if the texture that stores the data was resized
     */
    pub fn inject_images(&mut self, max_height: u32, images: GlyphImages) -> bool {
        //     const { device } = this;
        //     // first increase texture size if needed
        //     const resized = this.#increase_texture_size(max_height);
        //     // setup a command encoder to upload images all in one go
        //     const cE = device.createCommandEncoder();
        //     // upload each image to texture
        //     for (const { posX, posY, width, height, data } of images) {
        //       // first make sure width is a multiple of 256
        //       const paddedData = this.build_padded_buffer(data, width, height);
        //       this.upload_texture_data(
        //         this.shared_texture,
        //         paddedData.data,
        //         width,
        //         height,
        //         undefined,
        //         { x: posX, y: posY, z: 0 },
        //         1,
        //         cE,
        //       );
        //     }
        //     device.queue.submit([cE.finish()]);
        //     return resized;
        todo!()
    }

    /**
     * Inject a sprite image
     * @param message - the sprite image message containing the raw image data and it's shape
     * @returns true if the texture that stores the data was resized
     */
    pub fn inject_sprite_image(&mut self, message: SpriteImageMessage) -> bool {
        // const { image, offsetX, offsetY, width, height, max_height } = message;
        // // first increase texture size if needed
        // const resized = this.#increase_texture_size(max_height);
        // // then update texture
        // this.upload_texture_data(
        //   this.shared_texture,
        //   image,
        //   width,
        //   height,
        //   { x: 0, y: 0 },
        //   { x: offsetX, y: offsetY, z: 0 },
        // );
        // return resized;
        todo!()
    }

    /**
     * Increase a texture's size
     * @param new_height - the new height for the texture
     * @returns true if the texture was resized
     */
    fn _increase_texture_size(&mut self, new_height: u32) -> bool {
        if new_height <= self.shared_texture.height() {
            return false;
        }
        let new_texture = self.build_texture::<u8>(
            None,
            Some(&self.shared_texture),
            self.shared_texture.width(),
            Some(new_height),
            None,
            None,
            None,
            None,
            None,
            None,
        );
        self.shared_texture.destroy();
        self.shared_texture = new_texture;

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
        texture: Option<&wgpu::Texture>, // = this.shared_texture,
        label: Option<&str>,
    ) -> wgpu::BindGroup {
        let texture = texture.unwrap_or(&self.shared_texture);
        self.device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: label.or(Some("Fill Pattern BindGroup")),
            layout: &self.mask_pattern_bind_group_layout,
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 4,
                    resource: wgpu::BindingResource::Buffer(wgpu::BufferBinding {
                        buffer: &fill_texture_positions.buffer,
                        offset: 0,
                        size: None,
                    }),
                },
                wgpu::BindGroupEntry {
                    binding: 5,
                    resource: wgpu::BindingResource::Sampler(&self.pattern_sampler),
                },
                wgpu::BindGroupEntry {
                    binding: 6,
                    resource: wgpu::BindingResource::TextureView(
                        &texture.create_view(&wgpu::TextureViewDescriptor::default()),
                    ),
                },
            ],
        })
    }
}

async fn create_gpu_context(
    window: &winit::window::Window,
) -> (wgpu::Device, wgpu::Queue, wgpu::Surface<'static>) {
    // 1. Instance - The entry point for wgpu
    let instance = Instance::new(&wgpu::InstanceDescriptor {
        backends: Backends::all(), // Enables Vulkan, Metal, DX12, and GL
        ..Default::default()
    });
    // 2. Surface - The connection to your window
    let surface = unsafe {
        core::mem::transmute::<wgpu::Surface<'_>, wgpu::Surface<'static>>(
            instance.create_surface(&window).unwrap(),
        )
    };
    // 3. Adapter - The actual physical GPU handle
    let adapter = instance
        .request_adapter(&RequestAdapterOptions {
            power_preference: wgpu::PowerPreference::HighPerformance,
            compatible_surface: Some(&surface),
            force_fallback_adapter: false,
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
            trace: wgpu::Trace::Off,
        })
        .await
        .expect("Failed to create device");

    (device, queue, surface)
}

struct AutoSubmitEncoder<'a> {
    queue: &'a wgpu::Queue,
    encoder: Option<wgpu::CommandEncoder>,
}
impl<'a> AutoSubmitEncoder<'a> {
    fn new(queue: &'a wgpu::Queue, encoder: Option<wgpu::CommandEncoder>) -> Self {
        Self { queue, encoder }
    }

    fn encoder(&mut self) -> &mut wgpu::CommandEncoder {
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
