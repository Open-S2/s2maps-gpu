// Tool to convert old scheme S2JSON Geometry to new scheme

import type { S2FeatureCollection } from "gis-tools";

const file = './public/s2json/countriesHD.s2json';

const data: S2FeatureCollection = await Bun.file(file).json();

// fix geometry

for (const feature of data.features) {
  const { geometry } = feature;
  const { type, coordinates } = geometry;

  if (type === 'Point') {
    geometry.is3D = false;
    // @ts-expect-error - we are modifying it
    geometry.coordinates = { x: coordinates[0], y: coordinates[1] };
  } else if (type === 'MultiPoint' || type === 'LineString') {
    geometry.is3D = false;
    // @ts-expect-error - it's ok
    geometry.coordinates = coordinates.map(([x, y]) => ({ x, y }));
  } else if (type === 'MultiLineString' || type === 'Polygon') {
    geometry.is3D = false;
    // @ts-expect-error - it's ok
    geometry.coordinates = coordinates.map((points) => points.map(([x, y]) => ({ x, y })));
  } else if (type === 'MultiPolygon') {
    geometry.is3D = false;
    // @ts-expect-error - it's ok 
    geometry.coordinates = coordinates.map((polygons) => polygons.map((points) => points.map(([x, y]) => ({ x, y }))));
  }
}

// console.log('data', data);
await Bun.write(file, JSON.stringify(data, null, 2));
