import { toCamelCase } from '../strings';

test('Can change to camel case', () => {
  expect(toCamelCase('camel case')).toEqual('camelCase');
  expect(toCamelCase('Camel case')).toEqual('CamelCase');
  expect(toCamelCase('RHEL Relateds')).toEqual('RHELRelateds');
});
