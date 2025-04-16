# Geometry

The goal here is only to build code for the `s2json-spec` package while also providing additional geometry utilities necessary for other modules.

## TODO

### Generic

- [ ] **clean**: remove redundant points, (multi)linestring and/or (multi)polygon, fixes kinks, etc.

### Lines

- [ ] **along**: (given linestring find the point at distance provided)
- [ ] **length**: length of a linestring
- [ ] **pointToLineDistance**: distance from a point to a line
- [ ] **bezierSpline**: create a bezier spline from a line
- [ ] **cubicSpline**: create a cubic spline from a line

### Polygons

- [ ] **length**: length of each polygon ring
- [ ] **dekink**: remove kinks from a polygon
- [ ] **boolean**: boolean operations on polygons
