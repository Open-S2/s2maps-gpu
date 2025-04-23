import { filesize } from 'filesize';
import fs from 'fs';
import picocolors from 'picocolors';

const { blue, green, red, yellow } = picocolors;

/**
 * Build and print file sizes
 * @param inputFolder - the input folder to read from
 */
export function getFileSizes(inputFolder: string): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res: Record<string, any> = {
    js: {} as Record<string, Record<string, string>>,
    css: {} as Record<string, Record<string, string>>,
    jsTotalmin: 0 as number | string,
    jsTotalgz: 0 as number | string,
    jsTotalbr: 0 as number | string,
    cssTotalmin: 0 as number | string,
    cssTotalgz: 0 as number | string,
    cssTotalbr: 0 as number | string,
  };
  const files = fs.readdirSync(inputFolder);

  const cssFiles = files.filter((f) => f.includes('.min.css'));
  for (const file of cssFiles) {
    // s2maps-gpu.min.css
    const name = file.includes('.gz')
      ? file.split('.gz')[0]
      : file.includes('.br')
        ? file.split('.br')[0]
        : file;
    let fileType = file.split('.css').pop() as string;
    if (fileType === '') fileType = 'min';
    else fileType = fileType.slice(1);
    const { size } = fs.statSync(`${inputFolder}/${file}`);
    if (res.css[name] === undefined) res.css[name] = {};
    res.css[name][fileType] = filesize(size);
    res[`cssTotal${fileType}`] += size;
  }
  res.cssTotalmin = filesize(res.cssTotalmin);
  res.cssTotalgz = filesize(res.cssTotalgz);
  res.cssTotalbr = filesize(res.cssTotalbr);

  const jsFiles = files.filter(
    (f) => f.includes('.js') && !f.includes('.txt') && !f.includes('.map') && !f.includes('.json'),
  );
  for (const file of jsFiles) {
    const name = file.includes('.gz')
      ? file.split('.gz')[0]
      : file.includes('.br')
        ? file.split('.br')[0]
        : file;
    let fileType = file.split('.js').pop() as string;
    if (fileType === '') fileType = 'min';
    else fileType = fileType.slice(1);
    const { size } = fs.statSync(`${inputFolder}/${file}`);
    if (res.js[name] === undefined) res.js[name] = {};
    res.js[name][fileType] = filesize(size);
    res[`jsTotal${fileType}`] += size;
  }
  res.jsTotalmin = filesize(res.jsTotalmin);
  res.jsTotalgz = filesize(res.jsTotalgz);
  res.jsTotalbr = filesize(res.jsTotalbr);

  // CONSOLE CSS
  console.info(blue('CSS PACKAGES\n'));
  console.info(
    `${green('PACKAGE NAME')}                  ${red('MIN')}           ${blue('GZ')}           ${yellow('BR')}`,
  );
  for (const name in res.css) {
    const { min, br, gz } = res.css[name];
    console.info(
      `${green(name)}${' '.repeat(30 - name.length)}${red(min)}${' '.repeat(14 - min.length)}${blue(gz)}${' '.repeat(13 - gz.length)}${yellow(br)}`,
    );
  }
  console.info(
    `\n${green('TOTAL:')}${' '.repeat(30 - 6)}${red(res.cssTotalmin)}${' '.repeat(14 - res.cssTotalmin.length)}${blue(res.cssTotalgz)}${' '.repeat(13 - res.cssTotalgz.length)}${yellow(res.cssTotalbr)}`,
  );

  console.info('\n');

  // CONSOLE JS
  console.info(blue('JS MODULES\n'));
  console.info(
    `${green('PACKAGE NAME')}                  ${red('MIN')}           ${blue('GZ')}           ${yellow('BR')}`,
  );
  for (const name in res.js) {
    const { min, br, gz } = res.js[name];
    console.info(
      `${green(name)}${' '.repeat(30 - name.length)}${red(min)}${' '.repeat(14 - min.length)}${blue(gz)}${' '.repeat(13 - gz.length)}${yellow(br)}`,
    );
  }
  console.info(
    `\n${green('TOTAL:')}${' '.repeat(30 - 6)}${red(res.jsTotalmin)}${' '.repeat(14 - res.jsTotalmin.length)}${blue(res.jsTotalgz)}${' '.repeat(13 - res.jsTotalgz.length)}${yellow(res.jsTotalbr)}`,
  );

  console.info();
}
