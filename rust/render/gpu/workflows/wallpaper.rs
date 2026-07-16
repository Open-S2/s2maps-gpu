use crate::{
    render::{RenderContext, WebGPUBuffer},
    style::{Color, ColorArrayF32, StyleDefinition},
    ui::Projector,
};
use alloc::rc::Rc;
use core::cell::RefCell;
use libm::{fmin, pow};

/// Wallpaper Color Guide
#[derive(Debug, Clone, Copy)]
#[allow(missing_docs)]
pub struct WallpaperScheme {
    pub background: Color,
    pub fade1: Color,
    pub fade2: Color,
    pub halo: Color,
}

/// Wallpaper Workflow renders a user styled wallpaper to the GPU
#[derive(Debug, Clone)]
#[allow(missing_docs)]
pub struct WallpaperWorkflow {
    pub context: Rc<RefCell<RenderContext>>,
    pub scheme: WallpaperScheme,
    pub tile_size: u32,
    pub scale: Vec<f32>,
    pub pipeline: wgpu::RenderPipeline,
    uniform_buffer: WebGPUBuffer,
    wallpaper_bind_group_layout: wgpu::BindGroupLayout,
    bind_group: Option<wgpu::BindGroup>,
}
impl WallpaperWorkflow {
    /// Create a new WallpaperWorkflow
    ///
    /// ## Parameters
    /// - `context` - The WebGPU context
    pub fn new(context: Rc<RefCell<RenderContext>>) -> Self {
        let (wallpaper_bind_group_layout, pipeline) =
            WallpaperWorkflow::get_pipeline(&context.borrow());
        let uniform_buffer = {
            let input_slice: Vec<f32> = vec![0.0; 20];
            let bytes: &[u8] = bytemuck::cast_slice(&input_slice);
            context.borrow().build_gpu_buffer(
                "Wallpaper Uniform Buffer",
                bytes,
                wgpu::BufferUsages::UNIFORM,
                None,
            )
        };
        WallpaperWorkflow {
            context,
            scheme: WallpaperScheme {
                background: "#000".into(),
                fade1: "#000".into(),
                fade2: "#000".into(),
                halo: "#000".into(),
            },
            tile_size: 512,
            scale: vec![0.0, 0.0],
            pipeline,
            uniform_buffer,
            wallpaper_bind_group_layout,
            bind_group: None,
        }
    }

    /// Update the wallpaper style
    ///
    /// ## Parameters
    /// - `style`: input user defined style
    pub fn update_style(&mut self, style: &StyleDefinition) {
        // inject wallpaper into scheme
        if let Some(wallpaper) = &style.wallpaper {
            if let Some(background) = &wallpaper.background {
                self.scheme.background = background.into();
            }
            if let Some(fade1) = &wallpaper.fade1 {
                self.scheme.fade1 = fade1.into();
            }
            if let Some(fade2) = &wallpaper.fade2 {
                self.scheme.fade2 = fade2.into();
            }
            if let Some(halo) = &wallpaper.halo {
                self.scheme.halo = halo.into();
            }
        }
        // inject uniforms
        self._update_uniforms();
        // build the bind group
        self.bind_group = Some(self.context.borrow().build_group(
            "Wallpaper",
            &self.wallpaper_bind_group_layout,
            &[&self.uniform_buffer],
        ));
    }

    /// Update the scale
    ///
    /// ## Parameters
    /// - `projector`: The render Projector
    fn _update_scale(&mut self, projector: &Projector) {
        if projector.dirty {
            return;
        }
        let radius = ((self.tile_size as f64) * fmin(pow(2., projector.zoom), 32_768.)) as f32;
        let mult2 = (projector.multiplier / 2.) as f32;
        self.scale[0] = radius / (projector.aspect.x() / mult2);
        self.scale[1] = radius / (projector.aspect.y() / mult2);
        self.context.borrow().queue.write_buffer(
            &self.uniform_buffer.buffer,
            16 * 4,
            bytemuck::cast_slice(&self.scale),
        );
    }

    /// Update uniforms. Only updates on style change
    fn _update_uniforms(&mut self) {
        let colors: Vec<ColorArrayF32> = vec![
            self.scheme.fade1.get_rgb(Some(true), None).to_gpu(),
            self.scheme.fade2.get_rgb(Some(true), None).to_gpu(),
            self.scheme.halo.get_rgb(Some(true), None).to_gpu(),
            self.scheme.background.get_rgb(Some(true), None).to_gpu(),
        ];
        let bytes: &[u8] = bytemuck::cast_slice(&colors);
        self.context.borrow().queue.write_buffer(&self.uniform_buffer.buffer, 0, bytes);
    }

    /// Setup the GPU Pipeline for drawing.
    /// https://programmer.ink/think/several-best-practices-of-webgpu.html
    /// BEST PRACTICE 6: it is recommended to create pipeline asynchronously
    /// BEST PRACTICE 7: explicitly define pipeline layouts
    ///
    /// ## Returns
    /// the GPU Pipeline
    fn get_pipeline(context: &RenderContext) -> (wgpu::BindGroupLayout, wgpu::RenderPipeline) {
        // prep Wallpaper uniforms
        let wallpaper_bind_group_layout = context.build_layout(
            "Wallpaper",
            vec![wgpu::BufferBindingType::Uniform],
            Some(wgpu::ShaderStages::VERTEX | wgpu::ShaderStages::FRAGMENT),
        );

        let module = context.device.create_shader_module(wgpu::include_wgsl!(
            "../../../../s2/render/gpu/shaders/wallpaper.wgsl"
        ));
        let layout = context.device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
            label: Some("Wallpaper Pipeline Layout"),
            bind_group_layouts: &[
                context.frame_bind_group_layout.as_ref(),
                Some(&wallpaper_bind_group_layout),
            ],
            immediate_size: 0,
        });

        (
            wallpaper_bind_group_layout,
            context.device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
                label: Some("Wallpaper Pipeline"),
                layout: Some(&layout),
                vertex: wgpu::VertexState {
                    module: &module,
                    entry_point: Some("vMain"),
                    compilation_options: wgpu::PipelineCompilationOptions::default(),
                    buffers: &[],
                },
                primitive: wgpu::PrimitiveState {
                    topology: wgpu::PrimitiveTopology::TriangleList,
                    cull_mode: None,
                    ..Default::default()
                },
                depth_stencil: Some(wgpu::DepthStencilState {
                    format: wgpu::TextureFormat::Depth24PlusStencil8,
                    depth_write_enabled: Some(false),
                    depth_compare: Some(wgpu::CompareFunction::Always),
                    stencil: wgpu::StencilState::default(),
                    bias: wgpu::DepthBiasState::default(),
                }),
                multisample: wgpu::MultisampleState {
                    count: context.sample_count,
                    mask: !0,
                    alpha_to_coverage_enabled: false,
                },
                fragment: Some(wgpu::FragmentState {
                    module: &module,
                    entry_point: Some("fMain"),
                    compilation_options: wgpu::PipelineCompilationOptions::default(),
                    targets: &[Some(wgpu::ColorTargetState {
                        format: context.format,
                        blend: None,
                        write_mask: wgpu::ColorWrites::ALL,
                    })],
                }),
                multiview_mask: None,
                cache: None,
            }),
        )
    }

    /// Draw the wallpaper to the GPU
    ///
    /// ## Parameters
    /// - `projector`: The render Projector
    pub fn draw(&mut self, projector: &Projector, pass_encoder: &mut wgpu::RenderPass) {
        // update scale if needed
        if projector.dirty {
            self._update_scale(projector);
        }
        let context = &mut self.context.borrow_mut();
        // setup pipeline, bind groups, & buffers
        context.set_render_pipeline("Wallpaper".into(), &mut self.pipeline);
        pass_encoder.set_bind_group(1, &self.bind_group, &[]);
        // draw the quad
        pass_encoder.draw(0..6, 0..1);
    }
}
