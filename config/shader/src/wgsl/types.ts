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
  ShakeTable,
  ShakeOp,
  ShaderDefine,
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

export type SymbolTable = {
  modules?: ModuleRef[],
  declarations?: DeclarationRef[],
  externals?: DeclarationRef[],
  exports?: DeclarationRef[],
  bindings?: DeclarationRef[],
  symbols?: string[],
  visibles?: string[],
  globals?: string[],
  enables?: string[],
  linkable?: Record<string, true>,
};

export type ModuleRef = {
  at: number,
  symbols: string[],
  name: string,
  imports: ImportRef[],
};

export type DeclarationRef = {
  at: number,
  symbol: string,
  flags: RefFlags,
  func?: FunctionRef,
  variable?: VariableRef,
  constant?: VariableRef,
  alias?: TypeAliasRef,
  struct?: StructRef,
};

export type IdentifiersRef = {
  identifiers?: string[],
};

export type InferrableRef = {
  inferred?: InferRef[],
};

export type InferRef = {
  name: string,
  at: number,
};

export type EnableRef = {
  name: string,
  at: number,
};

// These are parsed just-in-time to save on structs
export type AttributeRef = string;
export type TypeRef = string;

export type AttributesRef = {
  attr?: AttributeRef[],
};

export type AnnotatedTypeRef = AttributesRef & {
  name: TypeRef,
};

export type ReturnTypeRef = TypeRef | AnnotatedTypeRef;

/*
export type TypeRef = {
  name: string,
  args?: TypeRef[],
};
*/

export type TypeAliasRef = AttributesRef & {
  name: string,
  type: TypeRef,
};

export type QualifiedTypeAliasRef = TypeAliasRef & {
  qual?: string,
};

export type FunctionRef = AttributesRef & IdentifiersRef & FunctionHeaderRef & InferrableRef;
export type VariableRef = AttributesRef & IdentifiersRef & VariableDeclarationRef;
export type ParameterRef = AttributesRef & {
  name: string,
  type: TypeRef,
};

export type FunctionHeaderRef = {
  name: string,
  type: ReturnTypeRef,
  parameters?: ParameterRef[] | string[],
};

export type VariableDeclarationRef = {
  name: string,
  type: TypeRef,
  qual?: string,
  value?: string,
};

export type StructMemberRef = AttributesRef & {
  name: string,
  type: TypeRef,
};

export type StructRef = AttributesRef & {
  name: string,
  members: StructMemberRef[],
};
