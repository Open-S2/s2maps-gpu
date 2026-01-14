// import { Color } from 'style/color/index.js';
// import parseFeature from 's2/style/parseFeature.js';

// import type { Callback } from 's2/style/parseFeature.js';
// import type { ColorArray } from 'style/color/index.js';
// import type { IDGen } from './process.spec.js';
// import type {
//   BuildCodeFunction,
//   GPUType,
//   InteractiveWorkerLayer,
//   LayerWorkerFunction,
//   NotNullOrObject,
//   Property,
//   ValueType,
// } from 'style/style.spec.js';
// import type { InteractiveObject, TileRequest } from '../worker.spec.js';
// import type { Properties, S2CellId } from 'gis-tools/index.js';

use crate::{
    style::{Color, GPUType, Input, InputValueType, InteractiveWorkerLayer},
    workers::{IDGen, InteractiveObject},
};
use alloc::{collections::BTreeMap, rc::Rc};
use core::cell::RefCell;
use libm::{fmax, fmin};
use s2json::Properties;

/// Code design input wrapper
// pub struct CodeDesignInput<T: InputValueType>(pub Input<T>, pub Option<Callback<T, ColorArray>>);

#[derive(Debug)]
#[allow(missing_docs)]
pub struct CodeDesign<T: InputValueType, F: Fn(T) -> Vec<f32>> {
    pub input: Input<T>,
    pub callback: Option<F>,
}

/// Basic case where we don't need a return
pub fn default_func<T: InputValueType>() -> impl Fn(T) -> Vec<f32> {
    move |_: T| vec![]
}

/**
 * Color function to convert a color to either RBG or LCH
 * @param lch - flag to use lch if true
 * @returns a color parsing function
 */
// pub fn color_func(lch: bool) -> Callback<String, ColorArray> {
//     |i: String| -> ColorArray {
//         let color = Color::new(i);
//         if lch { color.get_lch() } else { color.get_rgb() }
//     }
// }
pub fn color_func(lch: bool) -> impl Fn(String) -> Vec<f32> {
    move |i: String| {
        let mut color: Color = (&i).into();
        let color_data = if lch { color.get_lch() } else { color.get_rgb(None, None) };
        color_data.into()
    }
}

/**
 * Clamp tool to ensure the number is between -1 and 1
 * Callback<f64, f64>
 * @param i - input number
 * @returns clamped number
 */
pub fn clamp(i: f64) -> f64 {
    fmax(-1., fmin(1., i))
}

/**
 * # Vector Worker
 *
 * Base class for all vector workers.
 * Ensurses that all vector workers can reuse things like prepping and shipping interactive features,
 * flusing, id-generation, etc.
 */
#[derive(Debug, Clone)]
pub struct VectorWorker {
    id_gen: Rc<RefCell<IDGen>>,
    gpu_type: GPUType,
    interactive_map: BTreeMap<u64, InteractiveObject>,
}
impl VectorWorker {
    /**
     * @param id_gen - id generator to ensure features don't overlap
     * @param gpu_type - the GPU context of the map renderer (WebGL(1|2) | WebGPU)
     */
    pub fn new(id_gen: Rc<RefCell<IDGen>>, gpu_type: GPUType) -> VectorWorker {
        VectorWorker { id_gen, gpu_type, interactive_map: BTreeMap::new() }
    }

    /**
     * Add an interactive feature
     * @param id - feature id
     * @param properties - feature properties
     * @param worker_layer - worker layer to pull the interactive-properties from
     */
    fn _add_interactive_feature(
        &mut self,
        id: u64,
        properties: Properties,
        worker_layer: InteractiveWorkerLayer,
    ) {
        self.interactive_map.insert(
            id,
            InteractiveObject {
                __id: id,
                __cursor: worker_layer.cursor(),
                __name: worker_layer.name(),
                __source: worker_layer.source(),
                __layer: worker_layer.layer(),
                properties,
            },
        );
    }

    //   /**
    //    * Flush a tile-request to the render thread
    //    * @param mapID - id of the map to ship the data back to
    //    * @param tile - tile request
    //    * @param sourceName - name of the source the data belongs to
    //    * @param _wait - wait function. Not needed at this flush level.
    //    */
    //   async flush(
    //     mapID: string,
    //     tile: TileRequest,
    //     sourceName: string,
    //     _wait: Promise<void>,
    //   ): Promise<void> {
    //     await this.postInteractive(mapID, sourceName, tile.id);
    //   }

    //   /**
    //    * Build code for a vector layer
    //    * @param design - the design to modify
    //    * @returns the build function
    //    */
    //   build_code(design: CodeDesign<NotNullOrObject>): BuildCodeFunction {
    //     const featureFunctions: Array<LayerWorkerFunction<number | ColorArray>> = [];
    //     for (const [input, cb] of design) {
    //       featureFunctions.push(parseFeature<NotNullOrObject, ColorArray>(input, cb));
    //     }

    //     return (zoom: number, properties: Properties): [number[], number[]] => {
    //       // prep codes
    //       const webgl2Code: number[] = [];
    //       const webgl1Code: number[] = featureFunctions.flatMap((func) =>
    //         func(webgl2Code, properties, zoom),
    //       );

    //       return [webgl1Code, webgl2Code];
    //     };
    //   }

    //   /**
    //    * Post an interactive feature set to the render thread
    //    * @param mapID - id of the map to ship the data back to
    //    * @param sourceName - name of the source the data belongs to
    //    * @param tileID - tile id the features belong to
    //    */
    //   postInteractive(mapID: string, sourceName: string, tileID: S2CellId): void {
    //     if (this.interactive_map.size === 0) return;
    //     const interactiveGuide: number[] = [];
    //     const interactiveData: number[] = [];

    //     const textEncoder = new TextEncoder();

    //     let offset = 0;
    //     for (const [id, properties] of this.interactive_map) {
    //       const uint8Array = textEncoder.encode(JSON.stringify(properties));
    //       const length = uint8Array.length;
    //       interactiveGuide.push(id, offset, offset + length);
    //       for (const byte of uint8Array) interactiveData.push(byte);
    //       offset += length;
    //     }
    //     this.interactive_map.clear();

    //     // Upon building the batches, convert to buffers and ship.
    //     const interactiveGuideBuffer = new Uint32Array(interactiveGuide).buffer;
    //     const interactiveDataBuffer = new Uint8ClampedArray(interactiveData).buffer;
    //     // ship the vector data.
    //     postMessage(
    //       {
    //         mapID,
    //         type: 'interactive',
    //         sourceName,
    //         tileID,
    //         interactiveGuideBuffer,
    //         interactiveDataBuffer,
    //       },
    //       [interactiveGuideBuffer, interactiveDataBuffer],
    //     );
    //   }
}

// /**
//  * A convenience function to convert an ID to an RGBA encoded color
//  * @param id - the id to convert
//  * @returns an RGBA encoded color
//  */
// pub fn id_to_rgb(id: number) -> ColorArray {
//   return [id & 255, (id >> 8) & 255, (id >> 16) & 255, 0];
//   // ((color & 0xFF) as f64, ((color >> 8) & 0xFF) as f64, ((color >> 16) & 0xFF) as f64, 0.0)
// }
