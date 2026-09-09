import { readFile } from 'node:fs/promises';
import { transform } from 'esbuild';

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (!specifier.startsWith('.') || /\.[a-z]+$/i.test(specifier)) throw error;
    try {
      return await nextResolve(`${specifier}.ts`, context);
    } catch {
      return nextResolve(`${specifier}/index.ts`, context);
    }
  }
}

export async function load(url, context, nextLoad) {
  if (!url.endsWith('.ts')) return nextLoad(url, context);
  const source = await readFile(new URL(url), 'utf8');
  const result = await transform(source, {
    loader: 'ts',
    format: 'esm',
    target: 'es2022',
    sourcemap: 'inline',
    define: { 'import.meta.env': '{}' },
  });
  return { format: 'module', shortCircuit: true, source: result.code };
}

