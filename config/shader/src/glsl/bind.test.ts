import { bindBundle, bindingsToLinks, resolveBindings } from './bind';
import { loadModule } from './shader';
import { linkBundle } from './link';
import { formatAST } from '../util/tree'; 
import { addASTSerializer } from '../test/snapshot';

addASTSerializer(expect);

describe("bind", () => {
  
  it("binds an external", () => {
    
    const codeMain = `
    vec4 getColor();
    void main() {
      vec4 v;
      v.xyz = vec3(1.0, 0.0, 0.0);
      gl_FragColor = getColor();
    }
    `

    const codeSub = `
    vec4 getSubColor();
    
    vec4 colorUsed() { return vec4(0.0, 0.1, 0.2, 0.0); }
    vec4 colorNotUsed() { return vec4(0.0, 0.1, 0.2, 1.0); }

    #pragma export
    vec4 getColor() {
      return getSubColor() + colorUsed();
    }
    `
    
    const codeColor = `
    #pragma export
    vec4 getColor() { return vec4(1.0, 0.0, 1.0, 1.0); }
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
        uniform: { format: 'vec4', name: 'getColor', value: [0, 0.5, 1, 1], args: ['int'] },
        constant: [1, 0.5, 1, 1],
      },
      {
        uniform: { format: 'vec2', name: 'getSize', value: [1, 1], args: ['int'] },
        storage: {
          buffer: {} as any,
          format: 'vec2',
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
        uniform: { format: 'vec4', name: 'getColor', value: [0, 0.5, 1, 1], args: ['int'] },
        constant: [1, 0.5, 1, 1],
      },
      {
        uniform: { format: 'vec2', name: 'getSize', value: [1, 1], args: ['int'] },
        storage: {
          buffer: {} as any,
          format: 'vec2',
          length: 10,
          size: [10],
          version: 1,
        },
      },
    ];

    const code = `
    vec4 getColor(int);
    vec2 getSize(int);
    
    void main() {
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

    const {modules: [resolved], uniforms, bindings} = resolveBindings([bound]);
    const result = linkBundle(resolved);
    expect(result).toMatchSnapshot();
  });

});