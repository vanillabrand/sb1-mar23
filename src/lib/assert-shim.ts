export function ok(value: any, message?: string) {
  if (!value) {
    throw new Error(message || 'Assertion failed');
  }
}

export function strictEqual(actual: any, expected: any, message?: string) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected} but got ${actual}`);
  }
}

export default {
  ok,
  strictEqual,
  equal: strictEqual,
  deepEqual: strictEqual,
  deepStrictEqual: strictEqual
};