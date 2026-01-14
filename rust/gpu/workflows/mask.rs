use crate::gpu::{WebGPUBuffer, WebGPUContext};

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
    /**
     * Builds a mask source
     * @param division - number of division to slice the geometry by
     * @param context - The current rendering context
     * @returns The mask source
     */
    pub fn new(division: u32, context: &WebGPUContext) -> MaskSource {
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

/** Tile Mask Source */
#[derive(Debug, Clone)]
#[allow(missing_docs)]
pub struct TileMaskSource {
    pub mask: MaskSource,
    pub bind_group: wgpu::BindGroup,
    pub fill_pattern_bind_group: wgpu::BindGroup,
    pub uniform_buffer: WebGPUBuffer,
    pub position_buffer: WebGPUBuffer,
}
