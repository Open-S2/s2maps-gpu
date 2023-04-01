# Condition System

## Preface

This is by far the most complex portion of the mapping engine. In order to make
this system fly and use minimal CPU cycles, it ended up becoming somewhat complex.
Hence why this needs to be written. There are 2 ways layers are processed segregated
by text and everything else.

### Text

Clever use of Lamda Functions with javascript to be run once per tile. Using "step"
over "lin" or "expo" makes the most sense since the zoom property will only be
inputed at the tiles zoom. So if the tile has zoom 2, the input zoom on the layer
will be 2.

The lamda function will be built based upon the styles parameters and the inputs
are:

```js
(feature.properties, zoom) => result
```

### Fills, Lines, 3D, etc

encode color / lineWidth / etc. for the GPU to later decode. Each layer's 'layout'
and 'paint' properties are pre-parsed in the webworker. For each viable feature
that makes it past the filter phase, the preprocessed layout/paint properties are
individually run in proper order (read `orderLayer.js` for their order) like so:

```js
layer.layout[l](feature.properties, featureCode)
```

`featureCode` will store all the necessary data for the GPU to decode the proper
color/width/etc. during the render step. featureCode will be passed in as a uniform
and has a maximum size of 256 and so batches must be segregated accordingly.

NOTE: The webworker will only keep track of any feature specific encodings. This
is managed in `parseLayers.js` but the only encodings saved to the `featureCode`
array come from `dataCondition.js`.

This process is broken into two parts however. The second part is managed by the main
thread's Style object. The layer's layout/paint properties are encoded into Float32Array's
for future webgl uniforms so that the GPU knows how to prep each property during the draw.
Every time there is a layer change the uniforms update accordingly.
