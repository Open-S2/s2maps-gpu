import { formatAST } from '../util/tree';

export const addASTSerializer = (expect: any) => expect.addSnapshotSerializer({
  print(val: any) {
    if (typeof val !== 'object') return val.toString();
    if (val && val.positions && val.topNode) return formatAST(val.topNode, val.text);
    if (val && val.type && val.enterUnfinishedNodesBefore) return formatAST(val, '');
  },
  test(val: any) {
    return val && val.positions && val.topNode;
  },
});