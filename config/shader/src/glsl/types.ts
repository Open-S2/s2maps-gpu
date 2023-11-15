import {
  ParsedModuleCache as ParsedModuleCacheT,
  ParsedBundle as ParsedBundleT,
  ParsedModule as ParsedModuleT,
  ShaderModule as ShaderModuleT,
  VirtualTable as VirtualTableT,
  DataBinding as DataBindingT,
  ImportRef,
  RefFlags,
} from '../types';

export {
  RefFlags,
} from '../types';

export type {
  CompressedNode,
  ImportRef,
  ShaderDefine,
  ShakeTable,
  ShakeOp,
  StorageSource,
  LambdaSource,
  TextureSource,
  UniformAttribute,
  UniformAttributeValue,
  VirtualRender,
} from '../types';

export type ParsedModuleCache = ParsedModuleCacheT<SymbolTable>;
export type ParsedBundle = ParsedBundleT<SymbolTable>;
export type ParsedModule = ParsedModuleT<SymbolTable>;
export type ShaderModule = ShaderModuleT<SymbolTable>;
export type VirtualTable = VirtualTableT<SymbolTable>;
export type DataBinding = DataBindingT<SymbolTable>;

export type ShaderCompiler = (code: string, stage: string) => Uint8Array | Uint32Array;

export type ComboRef = ModuleRef | FunctionRef | DeclarationRef;

export type SymbolTable = {
  modules?: ModuleRef[],
  declarations?: DeclarationRef[],
  externals?: DeclarationRef[],
  exports?: DeclarationRef[],
  symbols?: SymbolRef[],
  visibles?: SymbolRef[],
  globals?: SymbolRef[],
  linkable?: Record<string, true>,
};

export type SymbolRef = string;

export type SymbolsRef = {
  at: number,
  symbols: SymbolRef[],
}

export type ModuleRef = SymbolsRef & {
  name: string,
  imports: ImportRef[],
}

export type FunctionRef = SymbolsRef & {
  func: PrototypeRef,
  identifiers?: string[],
  flags: RefFlags,
}

export type DeclarationRef = SymbolsRef & {
  func?: PrototypeRef,
  variable?: VariableRef,
  struct?: QualifiedStructRef,
  identifiers?: string[],
  flags: RefFlags,
}

export type TypeRef = {
  name: string,
  qualifiers?: string[],
  members?: MemberRef[],
}

export type PrototypeRef = {
  type: TypeRef,
  name: string,
  parameters: string[],
}

export type VariableRef = {
  type: TypeRef,
  locals: LocalRef[],
}

export type MemberRef = {
  type: TypeRef,
  name: string,
}

export type LocalRef = {
  name: string,
  expr: any,
}

export type QualifiedStructRef = {
  type: TypeRef,
  name: string,
  struct: StructRef,
}

export type StructRef = {
  members: MemberRef[],
}
