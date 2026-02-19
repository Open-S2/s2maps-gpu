use crate::{
    render::{RenderContext, WebGPUBuffer},
    source::{TileBounds, TileUniforms},
};
use alloc::rc::Rc;

/// Mask Source
#[derive(Debug, Clone)]
#[allow(missing_docs)]
pub struct MaskSource {
    pub vertex_buffer: WebGPUBuffer,
    pub index_buffer: WebGPUBuffer,
    pub code_type_buffer: WebGPUBuffer,
    pub count: u32,
    pub offset: u32,
}
impl MaskSource {
    /// Builds a mask source
    ///
    /// ## Parameters
    /// - `division`: number of division to slice the geometry by
    /// - `context`: The current rendering context
    ///
    /// ## Returns
    /// The mask source
    pub fn new(division: u32, context: &RenderContext) -> MaskSource {
        let mut vertices: Vec<f32> = vec![];
        let mut indices: Vec<u32> = vec![];
        // prep variables
        let index_length = division + 1;
        let f_division = division as f32;
        let mut t: f32;
        let mut s: f32;
        let mut index_above: u32;
        let mut index = 0;
        // now we can build out the vertices and indices
        // vertices
        for j in 0..=division {
            t = (1. / f_division) * (j as f32);
            for i in 0..=division {
                s = (1. / f_division) * (i as f32);
                vertices.push(s);
                vertices.push(t);
            }
        }
        // indices
        for j in 0..division {
            // add degenerate if j is not 0
            if j != 0 {
                indices.push((j + 1) * index_length);
            }
            for i in 0..=division {
                index = j * index_length + i;
                index_above = (j + 1) * index_length + i;
                indices.push(index_above);
                indices.push(index);
            }
            // upon finishing a row, add a degenerate
            indices.push(index);
        }

        let code_type_array: Vec<f32> = vec![0.];

        // return the mask
        MaskSource {
            vertex_buffer: context.build_gpu_buffer(
                "mask vertex buffer",
                &vertices,
                wgpu::BufferUsages::VERTEX,
                None,
            ),
            index_buffer: context.build_gpu_buffer(
                "mask index buffer",
                &indices,
                wgpu::BufferUsages::INDEX,
                None,
            ),
            code_type_buffer: context.build_gpu_buffer(
                "mask code type buffer",
                &code_type_array,
                wgpu::BufferUsages::VERTEX,
                None,
            ),
            count: indices.len() as u32,
            offset: 0,
        }
    }
}

/// Tile Mask Source
///
/// A mask source is generic square shaped geometry that works across tiles. However, a tile mask
/// source has tile specific buffers
#[derive(Debug, Clone)]
#[allow(missing_docs)]
pub struct TileMaskSource {
    pub mask: Rc<MaskSource>,
    pub uniform_buffer: WebGPUBuffer,
    pub position_buffer: WebGPUBuffer,
    pub layer_buffer: WebGPUBuffer,
    pub layer_code_buffer: WebGPUBuffer,
    pub feature_code_buffer: WebGPUBuffer,
    pub fill_texture_positions: WebGPUBuffer,
    pub bind_group: wgpu::BindGroup,
    pub fill_pattern_bind_group: wgpu::BindGroup,
}
impl TileMaskSource {
    /// Build the mask for a tile
    /// the zoom determines the number of divisions necessary to maintain a visually
    /// asthetic spherical shape. As we zoom in, the tiles are practically flat,
    /// so division is less useful.
    /// 0, 1 => 16  ;  2, 3 => 8  ;  4, 5 => 4  ;  6, 7 => 2  ;  8+ => 1
    /// context stores masks so we don't keep recreating them and put excess stress and memory on the GPU
    ///
    /// ## Parameters
    /// - `division`: number of division to slice the geometry by
    /// - `tile`: the tile to create the mask for
    ///
    /// ## Returns
    /// The tile mask source
    pub fn new(
        division: u32,
        context: &mut RenderContext,
        uniforms: &TileUniforms,
        bottom_top: &TileBounds,
    ) -> Self {
        // check if we have a mask for this level
        let mask = context.masks.get(&division).cloned().unwrap_or_else(|| {
            let mask = Rc::new(MaskSource::new(division, context));
            context.masks.insert(division, mask.clone());
            mask
        });

        // tile binding
        let uniform_buffer = context.build_gpu_buffer(
            "Tile Uniform Buffer",
            bytemuck::bytes_of(uniforms),
            wgpu::BufferUsages::UNIFORM,
            None,
        );
        let position_buffer = context.build_gpu_buffer(
            "Tile Position Buffer",
            bytemuck::bytes_of(bottom_top),
            wgpu::BufferUsages::UNIFORM,
            None,
        );
        // layer binding
        let layer_buffer = context.build_gpu_buffer(
            "Layer Uniform Buffer",
            &vec![1.0_f32, 0.],
            wgpu::BufferUsages::UNIFORM,
            None,
        );
        let layer_code_buffer = context.build_gpu_buffer(
            "Layer Code Buffer",
            &vec![0.0_f32],
            wgpu::BufferUsages::STORAGE,
            None,
        );
        // feature binding
        let feature_code_buffer = context.build_gpu_buffer(
            "Feature Code Buffer",
            &vec![0.0_f32],
            wgpu::BufferUsages::STORAGE,
            None,
        );
        // store the group
        let bind_group = context.build_group(
            "Feature BindGroup",
            context.feature_bind_group_layout.as_ref().unwrap(),
            &[
                &uniform_buffer,
                &position_buffer,
                &layer_buffer,
                &layer_code_buffer,
                &feature_code_buffer,
            ],
        );
        // pattern binding
        let fill_texture_positions = context.build_gpu_buffer(
            "Fill Texture Positions",
            &vec![0.0_f32; 5],
            wgpu::BufferUsages::UNIFORM,
            None,
        );
        let fill_pattern_bind_group = context.create_pattern_bind_group(
            &fill_texture_positions,
            context.null_texture.as_ref(),
            Some("Mask Fill Pattern BindGroup"),
        );
        // create the mask, copying the shape of other draw/workflow structures
        TileMaskSource {
            mask,
            uniform_buffer,
            position_buffer,
            layer_buffer,
            layer_code_buffer,
            feature_code_buffer,
            fill_texture_positions,
            bind_group,
            fill_pattern_bind_group,
        }
    }
    /// Update the "screen positions" of the Tile Mask given the tile bounds
    pub fn update_screen_positions(&self, context: &RenderContext, bottom_top: &TileBounds) {
        let bytes: &[u8] = bytemuck::bytes_of(bottom_top);
        context.queue.write_buffer(&self.position_buffer.buffer, 0, bytes);
    }
    /// Draw the mask
    pub fn draw(&self, context: &RenderContext) {
        // TODO: Shouldn't the tile specify its mask id sooner?
        // context.set_stencil_reference(tile.tmpMaskID);
        // context.painter.borrow().workflows.get("fill").unwrap().draw_mask(self);
        todo!()
    }
}
