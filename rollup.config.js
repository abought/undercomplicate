/**
 * Rollup bundle config for library.
 * We explicitly do not include babel here, as the bundle will almost always be bundled downstream.
 */
import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import { terser } from 'rollup-plugin-terser';


export default {
    input: 'esm/index.js',
    output: {
        file: 'dist/index.js',
        format: 'umd',
        name: 'undercomplicate',
        compact: true,
        sourcemap: true,
    },
    plugins: [resolve(), commonjs(),  terser()],
};
