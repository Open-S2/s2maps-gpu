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
impl From<RasterDefinition> for ImageDefinition {
    fn from(raster_definition: RasterDefinition) -> ImageDefinition {
        ImageDefinition::Raster(raster_definition)
    }
}
impl From<SensorDefinition> for ImageDefinition {
    fn from(sensor_definition: SensorDefinition) -> ImageDefinition {
        ImageDefinition::Sensor(sensor_definition)
    }
}
impl From<HillshadeDefinition> for ImageDefinition {
    fn from(hillshade_definition: HillshadeDefinition) -> ImageDefinition {
        ImageDefinition::Hillshade(hillshade_definition)
    }
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
impl From<RasterWorkerLayer> for ImageWorkerLayer {
    fn from(raster_worker_layer: RasterWorkerLayer) -> ImageWorkerLayer {
        ImageWorkerLayer::Raster(raster_worker_layer)
    }
}
impl From<SensorWorkerLayer> for ImageWorkerLayer {
    fn from(sensor_worker_layer: SensorWorkerLayer) -> ImageWorkerLayer {
        ImageWorkerLayer::Sensor(sensor_worker_layer)
    }
}
impl From<HillshadeWorkerLayer> for ImageWorkerLayer {
    fn from(hillshade_worker_layer: HillshadeWorkerLayer) -> ImageWorkerLayer {
        ImageWorkerLayer::Hillshade(hillshade_worker_layer)
    }
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

    /**
     * Setup an RGBA style layer for the appropriate layer type
     * @param layer_definition - input sensor/raster/hillshade layer
     * @returns the pre-processed worker layer
     */
    pub fn setup_layer(&self, layer_definition: ImageDefinition) -> ImageWorkerLayer {
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
        todo!()
    }

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

    /**
     * Build the raster tile
     * @param map_id - the map id to ship the data back to
     * @param source_name - the source name the data to belongs to
     * @param layers - the layers to process
     * @param tile - the tile request
     * @param data - the tile raster data
     * @param size - the tile size
     */
    async fn build_tile(
        &self,
        map_id: MapID,
        source_name: String,
        layers: Vec<ImageWorkerLayer>,
        tile: TileRequest,
        data: Vec<u8>,
        size: f64,
    ) {
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
        //         map_id,
        //         type: 'raster',
        //         tileID: id,
        //         size,
        //         source_name,
        //         featureGuides: rasterFeatures,
        //         image,
        //       };

        //       postMessage(rasterData, [image]);
        //     }
        //     if (sensorFeatures.length > 0 && time !== undefined) {
        //       const sensorData: SensorData = {
        //         map_id,
        //         type: 'sensor',
        //         tileID: id,
        //         size,
        //         source_name,
        //         featureGuides: sensorFeatures,
        //         image,
        //         time,
        //       };

        //       postMessage(sensorData, [image]);
        //     }
        //     if (HillshadeFeatures.length > 0) {
        //       const hillshadeData: HillshadeData = {
        //         map_id,
        //         type: 'hillshade',
        //         tileID: id,
        //         size: image.width,
        //         source_name,
        //         featureGuides: HillshadeFeatures,
        //         image,
        //       };

        //       postMessage(hillshadeData, [image]);
        //     }
        todo!()
    }

    /**
     * TODO: flush images
     * @param _map_id - the map id to ship the data back to
     * @param _tile - the tile request
     * @param _source_name - the source name the data to belongs to
     */
    fn flush(_map_id: MapID, _tile: TileRequest, _source_name: String) {}
}
