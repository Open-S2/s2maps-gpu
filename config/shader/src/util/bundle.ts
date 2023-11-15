import { UniformAttribute, ShaderModule, ParsedBundle, ParsedModule, TypeLike, ParameterLike, RefFlags as RF } from '../types';

const NO_LIBS: Record<string, any> = {};
const NO_ARGS: any[] = [];

export const getBundleKey = (bundle: ShaderModule): number => {
  return (('module' in bundle) ? bundle.key ?? bundle.module.key : bundle.key) ?? getBundleHash(bundle);
};

export const getBundleHash = (bundle: ShaderModule): number => {
  return ('module' in bundle) ? bundle.hash ?? bundle.module.hash : bundle.hash;
};

export const getBundleEntry = (bundle: ShaderModule) => {
  return ('module' in bundle) ? bundle.entry ?? bundle.module.entry : bundle.entry;
};

// Force module/bundle to bundle
export const toBundle = (bundle: ShaderModule): ParsedBundle => {
  if (bundle === undefined) throw new Error("Bundle is undefined");
  if (bundle === null) throw new Error("Bundle is null");
  if (typeof bundle === 'string') throw new Error("Bundle is a string instead of an object");

  if ('table' in bundle) return {
    module: bundle as ParsedModule,
  } as ParsedBundle;

  return bundle;
}

// Force module/bundle to module
export const toModule = (bundle: ShaderModule) => {
  if (bundle === undefined) throw new Error("Bundle is undefined");
  if (bundle === null) throw new Error("Bundle is null");
  if (typeof bundle === 'string') throw new Error("Bundle is a string instead of an object");

  if ('table' in bundle) return bundle as ParsedModule;
  return bundle.module;
}

// Parse escaped C-style string
export const parseString = (s: string) => s.slice(1, -1).replace(/\\(.)/g, '$1');

type ToTypeString = (t: TypeLike) => string;
type ToArgTypes = (t: ParameterLike[]) => string[];

export const makeDeclarationToAttribute = (
  toTypeString: ToTypeString,
  toArgTypes: ToArgTypes,
) => (
  d: any,
) => {
  if (d.func) {
    const {type, name, parameters, attr} = d.func;
    return {name, format: toTypeString(type), args: toArgTypes(parameters), attr};
  }
  if (d.variable) {
    const {type, name, parameters, attr} = d.variable;
    return {name, format: toTypeString(type), args: null, attr};
  }
  if (d.struct) {
    const {name, members, attr} = d.struct;
    const ms = members?.map(({name, type}: any) => ({
      name,
      format: toTypeString(type),
    }));
    const args = ms?.map(({format}: any) => format);
    return {name, format: name, args, members: ms, attr};
  }
  throw new Error(`Cannot convert declaration to attribute: ${JSON.stringify(d)}`);
}

// Replace custom types with a reference to the bundle
const resolveBundleType = (bundle: ShaderModule, attribute: UniformAttribute) => {
  const {format} = attribute;
  if (!format.match(/[A-Z]/)) return attribute;
  
  const {libs, module} = bundle as any as ParsedBundle;
  if (!libs || !module) return attribute;

  const {table: {modules}} = module;
  if (modules) for (const {name: lib, imports} of modules) {
    for (const {name, imported} of imports) {
      if (name === format) {
        const m = libs[lib];
        if (m) return {...attribute, format: {...m, entry: imported}};
      }
    }
  }

  return attribute;
}

// Convert bundle to attributes for its external declarations
export const makeBundleToAttributes = (
  toTypeString: ToTypeString,
  toArgTypes: ToArgTypes,
) => {
  const toAttribute = makeDeclarationToAttribute(toTypeString, toArgTypes);

  return (
    bundle: ShaderModule,
  ): UniformAttribute[] => {
    const module = toModule(bundle);
    const {table: {externals}} = module;

    const out: UniformAttribute[] = [];
    for (const d of externals) if (d.func ?? d.variable) {
      const attr = toAttribute(d);
      if (!(bundle as any).links?.[attr.name]) out.push(resolveBundleType(bundle, attr));
    }

    return out;
  };
};

// Convert bundle to attribute for entry point (or named declaration)
export const makeBundleToAttribute = (
  toTypeString: ToTypeString,
  toArgTypes: ToArgTypes,
) => {
  const toAttribute = makeDeclarationToAttribute(toTypeString, toArgTypes);

  return (
    bundle: ShaderModule,
    name?: string,
  ): UniformAttribute => {
    const module = toModule(bundle);
    const {table: {exports, externals}} = module;

    const entry = name ?? bundle.entry ?? module.entry;

    if (name != null) for (const d of externals) {
      if (
        d.func?.name === entry ||
        d.variable?.name === entry
      ) return resolveBundleType(bundle, toAttribute(d));
      if (d.struct?.name === entry) {
        return toAttribute(d);
      }
    }

    for (const d of exports) {
      if (
        d.func?.name === entry ||
        d.variable?.name === entry
      ) return resolveBundleType(bundle, toAttribute(d));
      if (d.struct?.name === entry) {
        return toAttribute(d);
      }
    }

    throw new Error(`Unknown attribute ${entry}`);
  };
};
