import { getGraphOrder } from './link';

describe("getGraphOrder", () => {
  const A = 1;
  const B = 2;
  const C = 3;
  const D = 4;
  const E = 5;

  it("gets graph order", () => {
    const graph = new Map();
    graph.set(A, [B, C]);
    graph.set(B, [D]);
    graph.set(D, [E]);
    graph.set(C, [D]);

    const order = getGraphOrder(graph, A);
    expect(Array.from(order.entries())).toMatchSnapshot();
  });
  
  it("detects cycles", () => {
    const graph = new Map();
    graph.set(A, [B, C]);
    graph.set(B, [D]);
    graph.set(C, [D, A]);

    try {
      const order = getGraphOrder(graph, A);
    }
    catch (e: any) {
      expect(e.message).toMatch(/Cycle detected/);
    }
    
  });
  
});