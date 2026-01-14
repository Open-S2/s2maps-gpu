// import { colorFunc } from './vectorWorker.js';
// import parseFeature from 's2/style/parseFeature.js';

// import type { CodeDesign } from './vectorWorker.js';
// import type { RasterWorker as RasterWorkerSpec } from './process.spec.js';
// import type {
//   BuildCodeFunctionZoom,
//   ColorArray,
//   GPUType,
//   HillshadeDefinition,
//   HillshadeWorkerLayer,
//   LayerWorkerFunction,
//   RasterDefinition,
//   RasterWorkerLayer,
//   SensorDefinition,
//   SensorWorkerLayer,
// } from 'style/style.spec.js';
// import type {
//   HillshadeData,
//   RasterData,
//   RasterDataGuide,
//   SensorData,
//   TileRequest,
// } from '../worker.spec.js';

use crate::{
    style::{
        BuildCodeFunctionZoom, ColorArray, GPUType, HillshadeDefinition, HillshadeWorkerLayer,
        RasterDefinition, RasterWorkerLayer, SensorDefinition, SensorWorkerLayer,
    },
    workers::{CodeDesign, MapID, TileRequest},
};
use alloc::vec::Vec;

/// Track the image type
#[derive(Debug, Clone, Copy, PartialEq)]
#[allow(missing_docs)]
pub enum ImageType {
    Raster,
    Sensor,
    Hillshade,
}

/// Raster Worker Layer Types
#[derive(Debug, Clone)]
#[allow(missing_docs)]
pub enum ImageDefinition {
    Raster(RasterDefinition),
    Sensor(SensorDefinition),
    Hillshade(HillshadeDefinition),
}
impl From<&ImageDefinition> for ImageType {
    fn from(image_definition: &ImageDefinition) -> ImageType {
        match image_definition {
            ImageDefinition::Raster(_) => ImageType::Raster,
            ImageDefinition::Sensor(_) => ImageType::Sensor,
            ImageDefinition::Hillshade(_) => ImageType::Hillshade,
        }
    }
}

/// Raster Worker Layer Types
#[derive(Debug, Clone)]
#[allow(missing_docs)]
pub enum ImageWorkerLayer {
    Raster(RasterWorkerLayer),
    Sensor(SensorWorkerLayer),
    Hillshade(HillshadeWorkerLayer),
}
impl From<&ImageWorkerLayer> for ImageType {
    fn from(iwl: &ImageWorkerLayer) -> ImageType {
        match iwl {
            ImageWorkerLayer::Raster(_) => ImageType::Raster,
            ImageWorkerLayer::Sensor(_) => ImageType::Sensor,
            ImageWorkerLayer::Hillshade(_) => ImageType::Hillshade,
        }
    }
}

/** Worker for processing raster data */
#[derive(Debug, Clone)]
#[allow(missing_docs)]
pub struct ImageWorker {
    pub gpu_type: GPUType,
}
impl ImageWorker {
    /** @param gpu_type - the GPU context of the map renderer (WebGL(1|2) | WebGPU) */
    pub fn new(gpu_type: GPUType) -> ImageWorker {
        ImageWorker { gpu_type }
    }

    //   /**
    //    * Setup an RGBA style layer for the appropriate layer type
    //    * @param layer_definition - input sensor/raster/hillshade layer
    //    * @returns the pre-processed worker layer
    //    */
    //   setup_layer(
    //     layer_definition: SensorDefinition | RasterDefinition | HillshadeDefinition,
    //   ): RasterWorkerLayer | SensorWorkerLayer | HillshadeWorkerLayer {
    //     const { type, name, layerIndex, source, layer, minzoom, maxzoom, opacity } = layer_definition;

    //     // build feature code design
    //     // opacity->saturation->contrast
    //     const design: CodeDesign = [[opacity]];
    //     if (type === 'raster') {
    //       const { saturation, contrast } = layer_definition;
    //       design.push([saturation], [contrast]);
    //     } else if (type === 'hillshade') {
    //       const { shadowColor, accentColor, highlightColor, azimuth, altitude, lch } = layer_definition;
    //       design.push(
    //         [shadowColor, colorFunc(lch)],
    //         [accentColor, colorFunc(lch)],
    //         [highlightColor, colorFunc(lch)],
    //         [azimuth],
    //         [altitude],
    //       );
    //     }

    //     return {
    //       type,
    //       name,
    //       layerIndex,
    //       source,
    //       layer,
    //       minzoom,
    //       maxzoom,
    //       getCode: this.buildCode(design),
    //     };
    //   }

    /**
     * Build code in relation to the design of the raster layer
     * @param design - the design to modify
     * @returns the build function
     */
    fn build_code<F: Fn(f32) -> Vec<f32>>(
        &self,
        design: Vec<CodeDesign<f32, F>>,
    ) -> BuildCodeFunctionZoom {
        // const { gpu_type } = this;

        // const feature_functions: Array<LayerWorkerFunction<f32 | ColorArray>> = vec![];
        // for (const [input, cb] of design) {
        //   feature_functions.push(parseFeature<number, ColorArray>(input, cb));
        // }

        // return (zoom: number) => {
        //   // prep codes
        //   const code: number[] = [];
        //   const properties = {};
        //   const webgl1Code: number[] = feature_functions
        //     .map((func) => func(code, properties, zoom))
        //     .flat();

        //   return gpu_type === 1 ? webgl1Code : code;
        // };
        todo!()
    }

    //   /**
    //    * Build the raster tile
    //    * @param mapID - the map id to ship the data back to
    //    * @param sourceName - the source name the data to belongs to
    //    * @param layers - the layers to process
    //    * @param tile - the tile request
    //    * @param data - the tile raster data
    //    * @param size - the tile size
    //    */
    //   async build_tile(
    //     mapID: string,
    //     sourceName: string,
    //     layers: Array<RasterWorkerLayer | SensorWorkerLayer | HillshadeWorkerLayer>,
    //     tile: TileRequest,
    //     data: ArrayBuffer,
    //     size: number,
    //   ): Promise<void> {
    //     // prep variables
    //     const { zoom, id, time } = tile;
    //     // prebuild feature code if webgl1
    //     const rasterFeatures: RasterDataGuide[] = [];
    //     const sensorFeatures: RasterDataGuide[] = [];
    //     const HillshadeFeatures: RasterDataGuide[] = [];
    //     for (const { type, getCode, layerIndex } of layers) {
    //       const guide =
    //         type === 'raster' ? rasterFeatures : type === 'sensor' ? sensorFeatures : HillshadeFeatures;
    //       guide.push({ code: getCode(zoom), layerIndex });
    //     }

    //     // https://bugzilla.mozilla.org/show_bug.cgi?id=1335594 - saved for posterity
    //     const image = await createImageBitmap(new Blob([data]), { premultiplyAlpha: 'none' });

    //     // ship the raster data.
    //     if (rasterFeatures.length > 0) {
    //       const rasterData: RasterData = {
    //         mapID,
    //         type: 'raster',
    //         tileID: id,
    //         size,
    //         sourceName,
    //         featureGuides: rasterFeatures,
    //         image,
    //       };

    //       postMessage(rasterData, [image]);
    //     }
    //     if (sensorFeatures.length > 0 && time !== undefined) {
    //       const sensorData: SensorData = {
    //         mapID,
    //         type: 'sensor',
    //         tileID: id,
    //         size,
    //         sourceName,
    //         featureGuides: sensorFeatures,
    //         image,
    //         time,
    //       };

    //       postMessage(sensorData, [image]);
    //     }
    //     if (HillshadeFeatures.length > 0) {
    //       const hillshadeData: HillshadeData = {
    //         mapID,
    //         type: 'hillshade',
    //         tileID: id,
    //         size: image.width,
    //         sourceName,
    //         featureGuides: HillshadeFeatures,
    //         image,
    //       };

    //       postMessage(hillshadeData, [image]);
    //     }
    //   }

    /**
     * TODO: flush images
     * @param _mapID - the map id to ship the data back to
     * @param _tile - the tile request
     * @param _sourceName - the source name the data to belongs to
     */
    fn flush(_map_id: MapID, _tile: TileRequest, _source_name: String) {}
}
