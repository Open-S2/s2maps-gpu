import { bindBundle, bindingsToLinks, resolveBindings } from './bind';
import { loadModule } from './shader';
import { linkBundle } from './link';
import { formatAST } from '../util/tree'; 
import { addASTSerializer } from '../test/snapshot';

addASTSerializer(expect);

describe("bind", () => {
  
  it("bind produces a bound bundle", () => {
    
    const codeMain = `
    @link fn getColor() -> vec4<f32> {};
    fn main() {
      var v: vec4<f32>;
      v = getColor();
      return v;
    }
    `

    const codeSub = `
    @link fn getSubColor() -> vec4<f32> {};

    fn colorUsed() -> vec4<f32> { return vec4<f32>(0.0, 0.1, 0.2, 0.0); }
    fn colorNotUsed() -> vec4<f32> { return vec4<f32>(0.0, 0.1, 0.2, 1.0); }

    @export fn getColor() -> vec4<f32> {
      return getSubColor() + colorUsed();
    }
    `

    const codeColor = `
    @export fn getColor() -> vec4<f32> { return vec4<f32>(1.0, 0.0, 1.0, 1.0); }
    `

    const module = loadModule(codeMain, 'main');
    const sub = loadModule(codeSub, 'sub');
    const getColor = loadModule(codeColor, 'getColor');

    const links = {"getSubColor:getColor": getColor};
    const defines = {'TEST': true};

    const bound = bindBundle(sub, links, defines);

    expect(bound.hash).not.toEqual(sub.table.hash);
    expect(bound.hash).toBeTruthy();
    expect(bound.links).toEqual(links);
    expect(bound.defines).toEqual(defines);

    expect(bound.hash).toMatchSnapshot();
  });
  
  it("binds an external", () => {
    
    const codeMain = `
    @link fn getColor() -> vec4<f32> {};
    fn main() {
      var v: vec4<f32>;
      v = getColor();
      return v;
    }
    `

    const codeSub = `
    @link fn getSubColor() -> vec4<f32> {};

    fn colorUsed() -> vec4<f32> { return vec4<f32>(0.0, 0.1, 0.2, 0.0); }
    fn colorNotUsed() -> vec4<f32> { return vec4<f32>(0.0, 0.1, 0.2, 1.0); }

    @export fn getColor() -> vec4<f32> {
      return getSubColor() + colorUsed();
    }
    `

    const codeColor = `
    @export fn getColor() -> vec4<f32> { return vec4<f32>(1.0, 0.0, 1.0, 1.0); }
    `

    const module = loadModule(codeMain, 'main');
    const sub = loadModule(codeSub, 'sub', 'getColor');
    const getColor = loadModule(codeColor, 'getColor');

    const links = {"getSubColor:getColor": getColor};
    const defines = {'TEST': true};

    {
      const linked = linkBundle(sub, links, defines);
      expect(linked).toMatchSnapshot();
    }

    {
      const bound = bindBundle(sub, links, defines);
      const linked = linkBundle(bound);
      expect(linked).toMatchSnapshot();
    }

    {
      const bound = bindBundle(sub, links, defines);
      const linked = linkBundle(module, {getColor: bound});
      expect(linked).toMatchSnapshot();
    }

  });

  it('makes deterministic links for data bindings', () => {
    const dataBindings = [
      {
        uniform: { format: 'vec4<f32>', name: 'getColor', value: [0, 0.5, 1, 1], args: ['i32'] },
        constant: [1, 0.5, 1, 1],
      },
      {
        uniform: { format: 'vec2<f32>', name: 'getSize', value: [1, 1], args: ['i32'] },
        storage: {
          buffer: {} as any,
          format: 'vec2<f32>',
          length: 10,
          size: [10],
          version: 1,
        },
      },
    ];

    const toSnapshot = (link: any) => {
      const { name, code, table, virtual: { uniforms, storages, textures, base }} = link;
      return { name, code, table, uniforms, storages, textures, base };
    }

    const links1 = bindingsToLinks(dataBindings);
    expect(toSnapshot(links1.getColor)).toMatchSnapshot();

    const links2 = bindingsToLinks(dataBindings);
    expect(toSnapshot(links2.getColor)).toEqual(toSnapshot(links1.getColor));
  });

  it('links data bindings', () => {
    const dataBindings = [
      {
        uniform: { format: 'vec4<f32>', name: 'getColor', value: [0, 0.5, 1, 1], args: ['i32'] },
        constant: [1, 0.5, 1, 1],
      },
      {
        uniform: { format: 'vec2<f32>', name: 'getSize', value: [1, 1], args: ['i32'] },
        storage: {
          buffer: {} as any,
          format: 'vec2<f32>',
          length: 10,
          size: [10],
          version: 1,
        },
      },
    ];

    const code = `
    @link fn getColor(i: i32) -> vec4<f32> {};
    @link fn getSize(i: i32) -> vec2<f32> {};

    fn main() {
      getColor(0);
      getSize(0);
    }
    `;

    const mod = loadModule(code, 'code');

    const toSnapshot = (link: any) => {
      const { name, code, table, virtual: { uniforms, storages, textures, base }} = link;
      return { name, code, table, uniforms, storages, textures, base };
    }

    const links = bindingsToLinks(dataBindings);
    const bound = bindBundle(mod, links);

    const fail = () => linkBundle(bound);
    expect(fail).toThrow();

    const defines = {'@group(VIRTUAL)': '@group(0)'};
    const {modules: [resolved], uniforms, bindings} = resolveBindings([bound], defines);
    const result = linkBundle(resolved, {}, defines);
    expect(result).toMatchSnapshot();
  });

});
