import { WGSLModules } from './wgsl.test.data';
import { linkCode, linkModule } from './link';
import { loadModule, wgsl } from './shader';
import { formatAST } from '../util/tree'; 
import { addASTSerializer } from '../test/snapshot';
import mapValues from 'lodash/mapValues';

const loadedModules = mapValues(WGSLModules, (v, k) => loadModule(v, k, k));

addASTSerializer(expect);

describe("link", () => {
  
  it("links an external", () => {
    
    const code = `
    @link fn getColor() -> vec4<f32> {};
    fn main() -> @location(0) vec4<f32> {
      return getColor();
    }
    `
    
    const getColor = `
    @export fn main() -> vec4<f32> { return vec4<f32>(1.0, 0.0, 1.0, 1.0); }
    `
    
    const linked = linkCode(code, {}, {getColor});
    expect(linked).toMatchSnapshot();

  });

  it("substitutes attributes", () => {
    
    const code = `
    @group(GROUP) @binding(BINDING) var<uniform> color: vec4<f32>;

    @link fn getColor() -> vec4<f32> {};
    fn main() -> @location(LOCATION) vec4<f32> {
      return getColor() + color;
    }
    `
    
    const getColor = `
    @export fn getColor() -> vec4<f32> { return vec4<f32>(1.0, 0.0, 1.0, 1.0); }
    `
    
    const defs = {
      '@group(GROUP)': '@group(0)',
      '@binding(BINDING)': '@binding(0)',
      '@location(LOCATION)': '@location(0)',
    };
    const linked = linkCode(code, {}, {getColor}, defs);
    expect(linked).toMatchSnapshot();

  });

  it("links quad vertex", () => {

    const getPosition = wgsl`
    @export fn getPosition(index: i32) -> vec4<f32> { return vec4<f32>(1.0, 0.0, 1.0, 1.0); }
    `

    const getPerspective = wgsl`
    @export fn getPerspective(index: i32) -> f32 { return 1.0; }
    `

    const getColor = wgsl`
    @export fn getColor(index: i32) -> vec4<f32> { return vec4<f32>(1.0, 0.0, 1.0, 1.0); }
    `

    const getSize = wgsl`
    @export fn getSize(index: i32) -> f32 { return 1.0; }
    `

    const getDepth = wgsl`
    @export fn getDepth(index: i32) -> f32 { return 0.5; }
    `

    const module = loadedModules['getQuadVertex'];
    const linked = linkModule(module, loadedModules, {getPosition, getPerspective, getColor, getSize, getDepth});
    expect(linked).toMatchSnapshot();

  });
  
  it("lifts recursive dependency", () => {
    
    const code = `
    use 'getLifted'::{ getLifted };
    use 'getColor1'::{ getColor1 };

    fn main() -> vec4<f32> {
      return getColor1();
    }
    `

    const getLifted = `
    // Lifted Code
    @export fn getLifted() {};
    `

    const getColor1 = `
    use 'getColor2'::{ getColor2 };
    @export fn getColor1() -> vec4<f32> { return getColor2(); }
    `
    
    const getColor2 = `
    use 'getLifted'::{ getLifted };
    @export fn getColor2() -> vec4<f32> { return vec4<f32>(1.0, 0.0, 1.0, 1.0); }
    `
    
    const linked = linkCode(code, {getColor1, getColor2, getLifted});
    expect(linked.indexOf('// Lifted Code')).toBeLessThan(linked.indexOf('getColor2'));
    expect(linked).toMatchSnapshot();

  });
  
  it("tree shakes constants", () => {
    const sub = `
    const colorUsed = vec4<f32>(0.0, 0.1, 0.2, 0.0);
    const colorNotUsed = vec4<f32>(0.0, 0.1, 0.2, 1.0);

    @export fn getColor() -> vec4<f32> {
      return colorUsed;
    }
    `

    const main = `
    @link fn getColor() -> vec4<f32> {};
    fn main() {
      var a = getColor();
    }
    `

    for (let compressed of [false, true]) {
      const modMain = loadModule(main, 'main', undefined, compressed);
      const modSub = loadModule(sub, 'sub', undefined, compressed);

      const getPosition = {...modSub, entry: 'getPosition'};
      const getColor = {...modSub, entry: 'getColor'};

      const linked = linkModule(modMain, {}, {getPosition, getColor});
      expect(linked).toMatchSnapshot();
    }
  })
  
  it("tree shakes around identifiers", () => {

    const sub = `
    fn used() -> f32 { return 1.0; }

    fn unused() -> f32 { return 1.0; }
    
    @export fn getPosition(index: i32) -> vec4<f32> { return vec4<f32>(used(), 0.0, 1.0, 1.0); }

    @export fn getColor(index: i32) -> vec4<f32> { return vec4<f32>(used(), 0.0, 1.0, 1.0); }
    `

    const main = `
    @link fn getPosition(index: i32) -> vec4<f32> {};
    fn main() {
      var a = getPosition(0);
    }
    `

    for (let compressed of [false, true]) {
      const modMain = loadModule(main, 'main', undefined, compressed);
      const modSub = loadModule(sub, 'sub', undefined, compressed);

      const getPosition = {...modSub, entry: 'getPosition'};
      const getColor = {...modSub, entry: 'getColor'};

      const linked = linkModule(modMain, {}, {getPosition, getColor});
      expect(linked).toMatchSnapshot();
    }

  });
  
  it("links same module twice with different entry point", () => {

    const sub = `
    fn used() -> f32 { return 1.0; }
    
    @export fn getPosition(index: i32) -> vec4<f32> { return vec4<f32>(used(), 0.0, 1.0, 1.0); }

    @export fn getColor(index: i32) -> vec4<f32> { return vec4<f32>(used(), 0.0, 1.0, 1.0); }
    `

    const main = `
    @link fn getPosition(index: i32) -> vec4<f32> {};
    @link fn getColor(index: i32) -> vec4<f32> {};
    fn main() {
      var a = getPosition(0);
      var b = getColor(0);
    }
    `

    const modMain = loadModule(main, 'main', undefined, false);
    const modSub = loadModule(sub, 'sub', undefined, false);

    const getPosition = {...modSub, entry: 'getPosition'};
    const getColor = {...modSub, entry: 'getColor'};

    const linked = linkModule(modMain, {}, {getPosition, getColor});
    expect(linked).toMatchSnapshot();

  });

  it("links a global across a module", () => {

    const sub1 = `
    @global @export fn getPosition(index: i32) -> vec4<f32> { return vec4<f32>(1.0, 0.0, 1.0, 1.0); }
    `

    const sub2 = `
    fn getPosition() {};
    
    @export fn getColor(index: i32) -> vec4<f32> {
      getPosition();
      return vec4<f32>(1.0, 0.0, 1.0, 1.0);
    }
    `

    const main = `
    @link fn getPosition(index: i32) -> vec4<f32> {};
    @link fn getColor(index: i32) -> vec4<f32> {};
    fn main() {
      var a = getPosition(0);
    }
    `

    const modMain = loadModule(main, 'main');
    const modSub1 = loadModule(sub1, 'sub1');
    const modSub2 = loadModule(sub2, 'sub2');

    const getPosition = {...modSub1, entry: 'getPosition'};
    const getColor = {...modSub2, entry: 'getColor'};

    const linked = linkModule(modMain, {}, {getPosition, getColor});
    expect(linked).toMatchSnapshot();

    expect(linked).toMatch(/fn getPosition\(index: i32\)/);
    expect(linked).not.toMatch(/fn _[A-Za-z0-9]{2,}_getPosition\(index: i32\)/);

    expect(linked).not.toMatch(/fn getPosition\(\)/);
    expect(linked).toMatch(/fn _[A-Za-z0-9]{2,}_getPosition\(\)/);

  });
  
  it("links a struct and field", () => {

    const sub1 = `
    @export struct Foo { bar: f32 };
    @export fn access(foo: Foo) -> f32 { return foo.bar; }
    fn bar() -> Foo { return Foo(1.0); }
    `

    const main = `
    @link struct Foo;
    @link fn access(foo: Foo) -> f32;

    fn main() {
      var a = getPosition(0);
    }
    `

    const modMain = loadModule(main, 'main');
    const modSub1 = loadModule(sub1, 'sub1');

    const Foo = {...modSub1, entry: 'Foo'};
    const access = {...modSub1, entry: 'access'};

    const linked = linkModule(modMain, {}, {Foo, access});
    expect(linked).toMatchSnapshot();

    expect(linked).toMatch(/Foo { bar: f32 }/);
    expect(linked).not.toMatch(/fn _[A-Za-z0-9]{2,}bar\(\)/);

  });

  it("hoists an enable directive", () => {
    
    const code = `
    @link fn getColor() -> vec4<f32> {};
    fn main() -> @location(0) vec4<f32> {
      return getColor();
    }
    `
    
    const getColor = `
    enable f16;
    @export fn main() -> vec4<f32> { return vec4<f32>(1.0, 0.0, 1.0, 1.0); }
    `
    
    const linked = linkCode(code, {}, {getColor});
    expect(linked).toMatchSnapshot();

  });
  
});
