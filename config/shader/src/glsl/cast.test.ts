import { loadModule } from './shader';
import { linkBundle } from './link';
import { castTo, swizzleTo } from './cast';

describe('cast', () => {
  
  it('swizzles', () => {

    const result = swizzleTo('vec3', 'vec3', 'xyx');    
    const recode = linkBundle(result);
    expect(recode).toMatchSnapshot();

  });
  
  it('casts', () => {
    
    const code = `
    #pragma export
    vec2 getValue() { return vec2(1.0, 2.0); }
    `;

    const mod = loadModule(code, 'code', 'getValue');
    const result = castTo(mod, 'vec3', 'xyx');
    
    const recode = linkBundle(result);
    expect(recode).toMatchSnapshot();

  });

  it('casts complex swizzle', () => {
    
    const code = `
      #pragma export
      vec2 getValue() { return vec2(1.0, 2.0); }
    `;

    const mod = loadModule(code, 'code', 'getValue');
    const result = castTo(mod, 'vec4<f32>', {
      basis: 'xy10',
      signs: '-+-+',
      gain: 2,
    });
    
    const recode = linkBundle(result);
    expect(recode).toMatchSnapshot();

  });

  it('casts compact swizzle', () => {
    
    const code = `
      #pragma export
      vec2 getValue() { return vec2(1.0, 2.0); }
    `;

    const mod = loadModule(code, 'code', 'getValue');
    const result = castTo(mod, 'vec4<f32>', {
      basis: 'xyzw',
      signs: '++-+',
      gain: 2,
    });
    
    const recode = linkBundle(result);
    expect(recode).toMatchSnapshot();

  });

  it('casts and links', () => {
    
    const code = `
    #pragma export
    vec2 getValue() { return vec2(1.0, 2.0); }
    `;

    const main = `
    vec3 getValue();
    void main() { getValue(); }
    `;

    const sub = loadModule(code, 'code', 'getValue');
    const mod = loadModule(main, 'main');
    const getValue = castTo(sub, 'vec3', 'xyx');

    const recode = linkBundle(mod, {getValue});
    expect(recode).toMatchSnapshot();

  });

});