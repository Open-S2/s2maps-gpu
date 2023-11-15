# @use-gpu/shader

```sh
npm install --save @use-gpu/shader
```

```sh
yarn add @use-gpu/shader
```

**Docs**: https://usegpu.live/docs/reference-library-@use-gpu-shader

# WGSL / GLSL Linker and Tree Shaker

A Typescript library to link together **snippets of shader code**, while removing dead code, very quickly. It supports both WGSL and GLSL, but it will only link code within a single language.

It enables two kinds of imports to be used:

**Static - Symbol Import**  (functions, declarations and types)

```wgsl
// WGSL
use 'path/to/color'::{ getColor };
```

```glsl
// GLSL
#pragma import { getColor } from 'path/to/color'
```

**Dynamic - Function Prototype** - Defined at run-time

```wgsl
// WGSL
@link fn getColor() -> vec4<f32> {};
```

```glsl
// GLSL
vec4 getColor();
```

This allows you to split up and organize your WGSL / GLSL code as you see fit, as well as create dynamic shader permutations. It also lets you bind shaders at run-time without immediate linking, thus providing an equivalent of WGSL / GLSL closures.

`@use-gpu/shader` supports GLSL 4.5 and WGSL 0.x (provisional). It uses custom [Lezer grammars](https://lezer.codemirror.net/) for the parsing.

#### Bundler

When combined with `@use-gpu/wgsl-loader` or `@use-gpu/glsl-loader`, you can import a tree of `.wgsl` / `.glsl` modules directly in JS/TS as a pre-packaged bundle:

```ts
// WGSL in JS/TS
import mainShader from 'path/to/main.wgsl';

import { linkBundle } from '@use-gpu/shader/wgsl';
const wgslCode = linkBundle(mainShader);
```

```ts
// GLSL in JS/TS
import mainShader from 'path/to/main.glsl';

import { linkBundle } from '@use-gpu/shader/glsl';
const glslCode = linkBundle(mainShader);
```

All dependencies will be parsed at build-time and deduplicated, using the normal import mechanism. They are packed with their symbol table and a sparse token list, so that code generation can happen immediately without re-parsing.

#### Closures

Bind shaders to each other using `bindBundle`. This returns a new module instead of immediately producing the linked shader code. The result acts as a WGSL / GLSL closure that you can use as a first-class value in your program:

```ts
const bound = bindBundle(bundle, {moduleA, moduleB});
```

The `bound` module can be passed around, and used as a new link to bind to another module recursively. This is highly useful to e.g. abstract over data sources or decorate shaders with new behavior.

#### Template literals

Use `wgsl` or `glsl` template literals to embed shaders inline:

```tsx
import { wgsl } from '@use-gpu/shader/wgsl`;

const wgslModule = wgsl`
  fn main() {}
`;
```

```tsx
import { glsl } from '@use-gpu/shader/glsl`;

const glslModule = glsl`
  void main() {}
`;
```

This is equivalent to a `loadModuleWithCache` call, so recent modules are cached by text hash. The default entry point is `main`.

Use `bindEntryPoint(module, 'entryPoint')` to bind different entry points.

Use `f32(x)`, `u32(x)` and `i32(x)` to format JS numbers correctly as WGSL strings (and `float`, `uint`, `int` for GLSL):

```tsx
import { wgsl, u32 } from '@use-gpu/shader/wgsl`;

const module = wgsl`
  fn main()  -> u32 { return ${u32(1)}; } // "1u"
  fn other() -> f32 { return ${f32(1)}; } // "1.0"
`;
```

Imports (`use` / `#pragma import`) do not work inside template literals, as they are parsed at run-time. Instead, import the WGSL symbols in JS, and use `bindBundle` to link them to the `wgsl` snippet:

```tsx
import { SurfaceFragment } from '@use-gpu/wgsl/use/types.wgsl';

const mainShader = bindBundle(wgsl`
  @link struct SurfaceFragment {};
  
  fn main() -> SurfaceFragment {
    // ...
  }
`, {SurfaceFragment});
```

#### Strings

You can skip the bundler and work with raw strings. In this case it is up to you to gather all the associated module code:

```ts
import { linkCode } from '@use-gpu/shader/wgsl';

const moduleA = "...";
const moduleB = "...";
const moduleC = "...";

const linked = linkCode(moduleC, {moduleA, moduleB});
```

Shaders parsed at run-time will be cached on a least-recently-used basis, based on content hash.

## Syntax (WGSL)

#### Linking

```wgsl
// Import symbols from a .wgsl file
use "path/to/file"::{ symbol, … };
use "path/to/file"::{ symbol as symbol, … };

// Function is linked at runtime. Function body is ignored and may be omitted.
@link fn func();

// Declaration is exported (can be linked to)
@export fn func() { };

// Function is linked at runtime but optional.
// Function body is used if not linked.
@link @optional fn func() -> f32 { return 1.0; }

// Type is linked at runtime
@link struct Type { };

// Storage binding is linked at runtime
@link var<storage> storageVar: array<f32>;

// Declaration is global (don't namespace it)
@global fn func() -> f32 { return 1.0; }
@global var name : i32;
```

#### Type Inference (WGSL only)

```wgsl
// Inferred type T
@infer type T;

// Infer T from linked argument type or return type
@link fn func(arg: @infer(T) T) -> f32 {}
@link fn func() -> @infer(T) T {}

// Inferred type T can be used throughout the .wgsl file
fn other(arg: T) -> T {
  // ...
}
```

## Syntax (GLSL)

```glsl
// Import symbols from a .glsl file
#pragma import { symbol, … } from "path/to/file"
#pragma import { symbol as symbol, … } from "path/to/file"

// Mark next declaration as exported
#pragma export

// Mark next function prototype as optional (e.g. inside an `#ifdef`)
#pragma optional

// Mark next declaration as global (don't namespace it)
#pragma global
```

## Example

#### Static Import

**Imports from other files** are declared using a Rust or ES-style directive referencing the filesystem:

**main.wgsl**
```wgsl
use 'path/to/color'::{ getColor };

fn main() -> vec4<f32> {
  return getColor();
}
```

**main.glsl**
```glsl
#pragma import { getColor } from 'path/to/color'

void main() {
  gl_FragColor = getColor();
}
```

Only exported symbols may be imported:

**path/to/color.wgsl**
```wgsl
@export fn getColor() -> vec4<f32> {
  return vec4<f32>(used(), 0.5, 0.0, 1.0);
}

fn used() -> f32 {
  return 1.0;
}

fn unused() {
  // ...
}
```

**path/to/color.glsl**
```glsl
#pragma export
vec4 getColor() {
  return vec4(used(), 0.5, 0.0, 1.0);
}

float used() {
  return 1.0;
}

void unused() {
  // ...
}
```

When passed to `linkBundle`, the result is:

**Linked result**

```wgsl
fn _u4_getColor() -> vec4<f32> {
  return vec4(_u4_used(), 0.5, 0.0, 1.0);
}

fn _u4_used() -> f32 {
  return 1.0;
}

fn main() -> vec4<f32> {
  return _u4_getColor();
}
```

```glsl
#version 450

vec4 _u4_getColor() {
  return vec4(_u4_used(), 0.5, 0.0, 1.0);
}

float _u4_used() {
  return 1.0;
}

void main() {
  gl_FragColor = _u4_getColor();
}
```

All top-level symbols outside the main module are namespaced with a prefix like `_u4_` to avoid collisions, unless marked as global.

#### Dynamic

For **dynamic linking at run-time**, you link up with a function prototype instead:

**main.wgsl**
```wgsl
@link fn getColor() -> vec4<f32>;

fn main() -> vec4<f32> {
  return getColor();
}
```

**main.glsl**
```glsl
vec4 getColor();

void main() {
  gl_FragColor = getColor();
}
```

Import named symbols from `.wgsl` or `.glsl` files in JS/TS, and use them directly as links:

```ts
import mainShader from 'path/to/main.wgsl';
import { getColor } from 'path/to/color.wgsl';

const wgslCode = linkBundle(mainShader, {getColor});
```

```ts
import mainShader from 'path/to/main.glsl';
import { getColor } from 'path/to/color.glsl';

const glslCode = linkBundle(mainShader, {getColor});
```

The linking mechanism works the same.


## Q&A

**Which 'version' of WGSL is supported?**

Best-effort compatibility with the current dialect of WGSL supported in the wild. If there are gaps in the grammar, let me know.

**Does this interpret GLSL pre-processor directives? (GLSL)**

No. It ignores and passes through all other `#directives`. This is done to avoid having to re-parse when definitions change.

This means the linker sees all top-level declarations regardless of `#if`s, and resolves all imports.

Mark prototypes as `#pragma optional` if it is ok to leave them unlinked.

**Isn't it silly to ship and work with strings instead of byte code?**

Processing pre-parsed WGSL / GLSL bundles is very fast and simple, even with tree shaking. Rewriting a SPIR-V program the same way is much more fiddly.


## API

### Link

Returns linked GLSL code by assembling:

  - `code` / `module` / `bundle`: Main module.
  - `modules`: Dictionary of modules to import manually from. `{ [path]: T }`
  - `links`: Dictionary of modules to link specific prototypes to. `{ [name]: T }`
  - `defines`: Dictionary of key/values to `const` / `#define` at the start.
  - `cache`: Override the internal cache or disable it.

  Use `from:to` as the link name to link two differently named functions.
  This is equivalent to a static `import { $to as $from } ...`.

#### `linkCode(…)`

Link direct source code.

```ts
(
  code: string,
  modules: Record<string, string> = {},
  links: Record<string, string> = {},
  defines: Record<string, string | number | boolean | null | undefined> = {},
  cache?: LRU | null,
) => string;
```

#### `linkModule(...)`

Link parsed modules.

```ts
(
  module: ParsedModule,
  modules: Record<string, ParsedModule> = {},
  links: Record<string, ParsedModule> = {},
  defines: Record<string, string | number | boolean | null | undefined> = {},
) => string;
```

#### `linkBundle(...)`

Link packaged bundle of module + libs.

```ts
(
  bundle: ParsedBundle | ParsedModule,
  links: Record<string, ParsedBundle | ParsedModule> = {},
  defines: Record<string, string | number | boolean | null | undefined> = {},
) => string;
```

#### `setPreamble(…)` (GLSL only)

```ts
(s: string) => void
```

Replace the global `#version 450` preamble with another string.


### Bind

Bind modules/bundles together into a new bundle at run-time.

```tsx
const bound = bindBundle(bundle, {links});
```

This is a fast operation which only affects the top-level module in a bundle.

The resulting bundle acts as a closure. Then link or rebind it:

```tsx
// Link it into a shader
linkBundle(mainBundle, {getData: bound});

// Bind it and make new module
const otherBound = bindBundle(otherBundle, {getData: bound});
```

#### `bindBundle(...)`

```ts
(
  bundle: ShaderModule,
  links: Record<string, ShaderModule> = {},
  defines?: Record<string, ShaderDefine> | null,
) => ParsedBundle;
```

#### `bindModule(...)`

```ts
(
  main: ParsedModule,
  libs: Record<string, ShaderModule> = {},
  links: Record<string, ShaderModule> = {},
  defines?: Record<string, ShaderDefine> | null,
) => ParsedBundle;
```

### Module 

Specify `entry` to point to a specific symbol as entry point.

#### `loadModule(…)`

Parse a code module into its in-memory representation (AST + symbol/shake table).

```ts
(
  code: string,
  name: string,
  entry?: string,
  compressed: boolean = false,
) => ParsedModule;
```

#### `loadModuleWithCache(…)`

Load a module from the given cache, or parse it if missing.

```ts
(
  code: string,
  name: string,
  entry?: string,
  cache: LRU | null = null,
) => ParsedModule;
```

#### `makeModuleCache(...)`

Wrapper around npm `LRU`.


## Colofon

Made by [Steven Wittens](https://acko.net). Part of `@use-gpu`.

