import { GLSLModules } from './glsl.test.data';
import { parseShader } from './shader';
import { makeASTParser } from './ast';
import { formatAST, formatASTNode } from '../util/tree';
import { addASTSerializer } from '../test/snapshot';

addASTSerializer(expect);

describe('shader', () => {
  
  it('parses', () => {
    const code = GLSLModules['getQuadVertex'];
    const tree = parseShader(code);
    expect(tree).toBeTruthy();
  });
  
});
