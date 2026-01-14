use crate::{
    gpu::{WebGPUBuffer, WebGPUContext},
    style::{Color, StyleDefinition},
    ui::{Camera, Mat4, Projector, Vec4},
    util::{UrlMap, create_image_bitmap, fetch_url},
};
use alloc::rc::Rc;
use core::cell::RefCell;

/** Skybox Workflow renders a user styled skybox to the GPU */
#[derive(Debug)]
#[allow(missing_docs)]
pub struct SkyboxWorkflow {
    pub context: Rc<RefCell<WebGPUContext>>,
    pub faces_ready: usize,
    pub ready: bool,
    pub fov: f32,
    pub angle: f32,
    pub matrix: Mat4,
    pub pipeline: wgpu::RenderPipeline,
    matrix_buffer: WebGPUBuffer,
    cube_map: Option<wgpu::Texture>,
    sampler: wgpu::Sampler,
    skybox_bind_group_layout: wgpu::BindGroupLayout,
    bind_group: Option<wgpu::BindGroup>,
}
impl SkyboxWorkflow {
    /** @param context - The WebGPU context */
    pub fn new(context: Rc<RefCell<WebGPUContext>>) -> Self {
        let matrix = Mat4::identity();
        // prep the matrix buffer
        let matrix_buffer = context.borrow().build_gpu_buffer(
            "Skybox Uniform Buffer",
            &matrix.0,
            wgpu::BufferUsages::UNIFORM,
            None,
        );
        // prep the sampler
        let sampler = context.borrow().device.create_sampler(&wgpu::SamplerDescriptor {
            mag_filter: wgpu::FilterMode::Linear,
            min_filter: wgpu::FilterMode::Linear,
            mipmap_filter: wgpu::MipmapFilterMode::Linear,
            address_mode_u: wgpu::AddressMode::ClampToEdge,
            address_mode_v: wgpu::AddressMode::ClampToEdge,
            address_mode_w: wgpu::AddressMode::ClampToEdge,
            ..Default::default()
        });
        let (skybox_bind_group_layout, pipeline) = SkyboxWorkflow::get_pipeline(&context.borrow());
        SkyboxWorkflow {
            context,
            faces_ready: 0,
            ready: false,
            fov: (80.0_f32).to_radians(),
            angle: (40.0_f32).to_radians(),
            matrix,
            pipeline,
            matrix_buffer,
            cube_map: None,
            sampler,
            skybox_bind_group_layout,
            bind_group: None,
        }
    }

    /**
     * Update the skybox style
     * @param style - user defined style
     * @param camera - The camera
     * @param url_map - The url map to properly resolve urls
     */
    pub fn update_style(
        &mut self,
        style: &StyleDefinition,
        camera: &mut Camera,
        url_map: &mut UrlMap,
    ) {
        if let Some(skybox) = &style.skybox {
            let path = url_map.adjust_url(skybox.path.clone());
            // grab clear color and set inside painter
            if let Some(loading_background) = &skybox.loading_background {
                let mut color: Color = loading_background.into();
                self.context.borrow_mut().set_clear_color(color.get_rgb(None, None));
            }
            // build a cube map and sampler
            if let Some(cube_map) = &self.cube_map {
                cube_map.destroy();
            }
            let size = skybox.size as u32;
            self.cube_map = Some(self.context.borrow().build_texture::<()>(
                None,
                None,
                size,
                Some(size),
                Some(6),
                None,
                None,
                None,
                None,
                Some("Skybox Cube Map"),
            ));
            self.bind_group =
                Some(self.context.borrow().device.create_bind_group(&wgpu::BindGroupDescriptor {
                    label: Some("Skybox BindGroup"),
                    layout: &self.skybox_bind_group_layout,
                    entries: &[
                        wgpu::BindGroupEntry {
                            binding: 0,
                            resource: wgpu::BindingResource::Buffer(wgpu::BufferBinding {
                                buffer: &self.matrix_buffer.buffer,
                                offset: 0,
                                size: None,
                            }),
                        },
                        wgpu::BindGroupEntry {
                            binding: 1,
                            resource: wgpu::BindingResource::Sampler(&self.sampler),
                        },
                        wgpu::BindGroupEntry {
                            binding: 2,
                            resource: wgpu::BindingResource::TextureView(
                                &self.cube_map.as_ref().unwrap().create_view(
                                    &wgpu::TextureViewDescriptor {
                                        dimension: Some(wgpu::TextureViewDimension::Cube),
                                        ..Default::default()
                                    },
                                ),
                            ),
                        },
                    ],
                }));
            // reset our tracking variables
            self.faces_ready = 0;
            self.ready = false;
            // request each face and assign to cube map
            for i in 0..6 {
                // TODO: Actuall run these
                self._get_image(i, format!("{path}/{size}/{i}.{}", skybox.r#type), camera);
            }
        }
    }

    /**
     * Setup the skybox pipeline
     * https://programmer.ink/think/several-best-practices-of-webgpu.html
     * BEST PRACTICE 6: it is recommended to create pipeline asynchronously
     * BEST PRACTICE 7: explicitly define pipeline layouts
     * @returns the WebGPU pipeline
     */
    fn get_pipeline(context: &WebGPUContext) -> (wgpu::BindGroupLayout, wgpu::RenderPipeline) {
        // prep skybox uniforms
        let skybox_bind_group_layout =
            context.device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
                label: Some("Skybox BindGroupLayout"),
                entries: &[
                    // matrix
                    wgpu::BindGroupLayoutEntry {
                        binding: 0,
                        visibility: wgpu::ShaderStages::VERTEX,
                        ty: wgpu::BindingType::Buffer {
                            ty: wgpu::BufferBindingType::Uniform,
                            has_dynamic_offset: false,
                            min_binding_size: None,
                        },
                        count: None,
                    },
                    // sampler
                    wgpu::BindGroupLayoutEntry {
                        binding: 1,
                        visibility: wgpu::ShaderStages::FRAGMENT,
                        ty: wgpu::BindingType::Sampler(wgpu::SamplerBindingType::Filtering),
                        count: None,
                    },
                    // texture
                    wgpu::BindGroupLayoutEntry {
                        binding: 2,
                        visibility: wgpu::ShaderStages::FRAGMENT,
                        ty: wgpu::BindingType::Texture {
                            sample_type: wgpu::TextureSampleType::Float { filterable: true },
                            view_dimension: wgpu::TextureViewDimension::Cube,
                            multisampled: false,
                        },
                        count: None,
                    },
                ],
            });

        let module = context.device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("Skybox Shader Module"),
            source: wgpu::ShaderSource::Wgsl(
                include_str!("../../../s2/gpu/shaders/skybox.wgsl").into(),
            ),
        });
        let layout = context.device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
            label: Some("Skybox Pipeline Layout"),
            bind_group_layouts: &[&context.frame_bind_group_layout, &skybox_bind_group_layout],
            immediate_size: 0,
        });

        let pipeline = context.device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
            label: Some("Skybox Pipeline"),
            layout: Some(&layout),
            vertex: wgpu::VertexState {
                module: &module,
                entry_point: Some("vMain"),
                compilation_options: wgpu::PipelineCompilationOptions::default(),
                buffers: &[],
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
            // primitive: { topology: 'triangle-list', cullMode: 'none' },
            primitive: wgpu::PrimitiveState {
                topology: wgpu::PrimitiveTopology::TriangleList,
                strip_index_format: None,
                front_face: wgpu::FrontFace::Cw,
                cull_mode: None,
                unclipped_depth: false,
                polygon_mode: wgpu::PolygonMode::Fill,
                conservative: false,
            },
            multisample: wgpu::MultisampleState {
                count: context.sample_count,
                mask: !0,
                alpha_to_coverage_enabled: false,
            },
            depth_stencil: Some(wgpu::DepthStencilState {
                format: wgpu::TextureFormat::Depth24PlusStencil8,
                depth_write_enabled: false,
                depth_compare: wgpu::CompareFunction::Always,
                stencil: wgpu::StencilState::default(),
                bias: wgpu::DepthBiasState::default(),
            }),
            multiview_mask: None,
            cache: None,
        });

        (skybox_bind_group_layout, pipeline)
    }

    /**
     * Get the appropriate cube map image and upload the data to the GPU
     * @param index - the index
     * @param path - the path to the image
     * @param camera - the camera
     */
    async fn _get_image(&mut self, index: u32, url: String, camera: &mut Camera) -> Result<(), ()> {
        let image_bytes = fetch_url::<()>(&url, &[], None, None).await?;
        let image = create_image_bitmap(image_bytes).await?;
        // upload to texture
        self.context.borrow().upload_texture_data(
            &self.cube_map.as_ref().unwrap(),
            &image.data,
            image.width,
            image.height,
            wgpu::Origin3d { x: 0, y: 0, z: index },
            1,
            None,
        );
        // set the projector as dirty to ensure a proper initial render
        camera.projector.reset();
        // call the full re-render
        camera.render();
        // update the ready count
        self.faces_ready += 1;
        // if all faces are uploaded, set the skybox as ready
        if self.faces_ready == 6 {
            self.ready = true;
        }

        Ok(())
    }

    /**
     * Update to the projector's current matrix
     * @param projector - The projector
     */
    fn _update_matrix(&mut self, projector: &Projector) {
        // create a perspective matrix
        self.matrix =
            Mat4::perspective(self.fov, projector.aspect.x() / projector.aspect.y(), 1., 10000.);
        // rotate perspective
        self.matrix.rotate(&Vec4::new(
            projector.lat.to_radians() as f32,
            projector.lon.to_radians() as f32,
            self.angle,
            0.,
        ));
        // this is a simplified "lookat", since we maintain a set camera position
        self.matrix
            .multiply(&Mat4([1., 0., 0., 0., 0., 1., 0., 0., 0., 0., 1., 0., 0., 0., 0., 1.]));
        // invert view
        self.matrix.invert();
        // update matrix for the GPU
        let bytes: &[u8] = bytemuck::cast_slice(&self.matrix.0);
        self.context.borrow().queue.write_buffer(&self.matrix_buffer.buffer, 0, bytes);
    }

    /**
     * Draw the skybox
     * @param projector - The projector
     */
    pub fn draw(&mut self, projector: &Projector, pass_encoder: &mut wgpu::RenderPass) {
        // update  matrix if necessary
        if projector.dirty {
            self._update_matrix(projector);
        }
        // setup pipeline, bind groups, & buffers
        self.context.borrow_mut().set_render_pipeline("skybox".into(), &mut self.pipeline);
        pass_encoder.set_bind_group(1, &self.bind_group, &[]);
        // draw the quad
        pass_encoder.draw(0..6, 0..1);
    }
}
