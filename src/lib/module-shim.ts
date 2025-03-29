// Basic implementation of Node's createRequire function for browser compatibility
export function createRequire(filename: string) {
  return function require(moduleId: string) {
    throw new Error(
      `Dynamic requires are not supported in browser environment. ` +
      `Cannot require '${moduleId}' from '${filename}'`
    );
  };
}

// Add other module-related shims if needed
export const builtinModules: string[] = [];

export default {
  createRequire,
  builtinModules
};