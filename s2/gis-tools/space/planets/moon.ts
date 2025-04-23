/** Moon's radius in meters */
export const MOON_RADIUS = 1_737_400;
/** Moon's equitorial radius in meters */
export const MOON_RADIUS_EQUATORIAL = 1_738_100;
/** Moon's polar radius in meters */
export const MOON_RADIUS_POLAR = 1_736_000;
/** The average circumference of the Moon in meters. */
export const MOON_CIRCUMFERENCE = 10_916_406.152693814; // 2.0 * Math.PI * MOON_RADIUS;
/**
 * The altitude of the highest known point on the Moon in meters.
 * https://www.lroc.asu.edu/images/249
 */
export const MOON_HIGHEST_ALTITUDE = 10_786.0;
/**
 * The altitude of the lowest known point on the Moon in meters.
 * https://en.wikipedia.org/wiki/Antoniadi_%28lunar_crater%29
 */
export const MOON_LOWEST_ALTITUDE = -9_178.0;

// Sources:

// Imagery
// North Pole:
// https://pds.lroc.asu.edu/data/LRO-L-LROC-5-RDR-V1.0/LROLRC_2001/DATA/BDR/NAC_POLE/NAC_POLE_NORTH/
// https://wms.lroc.asu.edu/lroc/view_rdr_product/WAC_GLOBAL_P900N0000_100M
// South Pole:
// https://pds.lroc.asu.edu/data/LRO-L-LROC-5-RDR-V1.0/LROLRC_2001/DATA/BDR/NAC_POLE/NAC_POLE_SOUTH/
// https://wms.lroc.asu.edu/lroc/view_rdr_product/WAC_GLOBAL_P900S0000_100M
// Global Mosaic:
// https://astrogeology.usgs.gov/search/map/moon_lro_lroc_wac_global_morphology_mosaic_100m

// Terrain
// 60deg to 90deg (60m, 30m, 20m, 10m, 5m resolutions):
// https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/jp2/
// 60s to 60n:
// https://astrogeology.usgs.gov/search/map/moon_lro_lola_selene_kaguya_tc_dem_merge_60n60s_59m
