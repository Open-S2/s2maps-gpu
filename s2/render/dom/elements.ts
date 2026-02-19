import type { VectorPoint } from 's2/gis-tools/index.js';

/**
 * Creates an HTML element and appends it to a container if provided
 * @param tagName - the name of the element
 * @param className - the class of the element
 * @param container - the container to append the element to
 * @returns an HTML element
 */
export function elCreate(tagName: string, className: string, container?: HTMLElement): HTMLElement {
  const el = document.createElement(tagName);
  el.className = className ?? '';

  if (container !== undefined) container.appendChild(el);
  return el;
}

/**
 * Creates an SVG element
 * @param name - the name of the element
 * @returns an SVG element
 */
export function svgCreate(name: string): SVGElement {
  return document.createElementNS('http://www.w3.org/2000/svg', name);
}

/**
 * Converts an array of rings to an SVG path string
 * @param rings - an array of rings
 * @param closed - whether the rings are closed or not (polygon or linestring)
 * @returns an SVG path string
 */
export function pointsToPath(rings: VectorPoint[][], closed: boolean): string {
  const str = rings
    .flatMap((points) => [
      ...points.map((p, j) => `${(j !== 0 ? 'L' : 'M') + p.x} ${p.y}`),
      // closes the ring for polygons
      closed ? 'z' : '',
    ])
    .join('');

  // SVG complains about empty path strings
  return str ?? 'M0 0';
}
