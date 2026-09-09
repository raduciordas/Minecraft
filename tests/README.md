# Testing

Run the full local quality gate with:

```bash
npm ci
npm run check
```

`npm test` uses Node's built-in test runner. `tests/ts-loader.mjs` compiles the
TypeScript modules through the `esbuild` copy already installed by Vite, so the
suite adds no test-only package to the application.

The suite covers the Blockly interpreter, all curriculum solutions and rewards,
inventory and health state, timed status effects, voxel indexing, and special
block indexing. `npm run check` also runs the production TypeScript check and
Vite build.

