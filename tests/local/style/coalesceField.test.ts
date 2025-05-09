import coalesceField from 'style/coalesceField.js';
import { expect, test } from 'vitest';

import type { Properties } from 's2';

test('coalesceField - complex field with fallbacks', () => {
  const properties: Properties = { abbr: 'U.S.', name: 'United States' };
  const field = ['"', '?abbr,?name', '"'];

  expect(coalesceField(field, properties)).toEqual('"U.S."');

  delete properties.abbr;

  expect(coalesceField(field, properties)).toEqual('"United States"');
});

test('coalesceField - simple field', () => {
  const properties: Properties = { abbr: 'U.S.', name: 'United States' };
  const field = '?name';

  expect(coalesceField(field, properties)).toEqual('United States');
});

test('coalesceField - simple field', () => {
  const properties: Properties = { abbr: 'U.S.', name: 'United States' };
  const field = 'name';

  expect(coalesceField(field, properties)).toEqual('name');
});

test('coalesceField - nested key', () => {
  const properties: Properties = { name: { abbr: 'U.S.' } };
  const field = {
    nestedKey: ['name', '?abbr'],
  };

  expect(coalesceField(field, properties)).toEqual('U.S.');
});

test('coalesceField - transform key', () => {
  const properties: Properties = { abbr: 'U.S.', name: 'uniteD states', name_en: 'The USA' };

  // Replace
  const field = '?name';
  expect(coalesceField(field, properties)).toEqual('uniteD states');

  // Replace uppercase
  const field2 = '?!Uname';
  expect(coalesceField(field2, properties)).toEqual('UNITED STATES');

  // Replace lowercase
  const field3 = '?!Lname';
  expect(coalesceField(field3, properties)).toEqual('united states');

  // Replace capitalize
  const field4 = '?!Cname';
  expect(coalesceField(field4, properties)).toEqual('United States');

  // Replace language aquisition
  const field5 = '?!Pname_XX';
  expect(coalesceField(field5, properties)).toEqual('The USA');

  // Replace non found
  const field6 = '?test';
  expect(coalesceField(field6, properties)).toEqual('');
});
