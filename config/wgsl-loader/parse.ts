import fs from 'fs';

/**
 * @param path
 * @param contents
 */
export default function (path: string, contents: string): string {
  return `export default "${parse(path, contents)}"\n`;
}

/**
 * @param path
 * @param contents
 */
function parse(path, contents) {
  const relativePath = path.split('/').slice(0, -1).join('/');
  return _parse(relativePath, contents);
}

/**
 * @param relativePath
 * @param contents
 */
function _parse(relativePath: string, contents: string) {
  const lines = contents.split('\n');
  const splitContents: string[] = [];
  for (const line of lines) {
    if (line.startsWith('#include')) {
      let includePath = line.split(' ')[1];
      includePath = includePath.slice(0, -1);
      const fullPath = `${relativePath}/${includePath}`;
      const subContents = fs.readFileSync(fullPath, 'utf8');
      splitContents.push(parse(fullPath, subContents));
    } else {
      splitContents.push(line);
    }
  }
  return sanitizeStringForExport(splitContents.join('\n'));
}

/**
 * Sanitize a string for export
 * @param str {string} - The string to sanitize
 * @returns The sanitized string
 */
function sanitizeStringForExport(str: string): string {
  // Remove single-line comments
  str = str.replace(/\/\/.*$/gm, '');
  // Remove multi-line comments
  str = str.replace(/\/\*[\s\S]*?\*\//g, '');
  // Replace line breaks with '\n'
  str = str.replace(/\n/g, '\\n');
  // Escape double quotes
  str = str.replace(/"/g, '\\"');
  return str;
}
