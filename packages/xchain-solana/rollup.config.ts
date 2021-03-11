import typescript from 'rollup-plugin-typescript2'

import pkg from './package.json'

export default {
  input: 'src/index.ts',
  output: [
    {
      file: pkg.main,
      format: 'cjs',
      exports: 'named',
      sourcemap: true,
    },
    {
      file: pkg.module,
      format: 'es',
      exports: 'named',
      sourcemap: true,
    },
  ],
  plugins: [
    typescript({
      rollupCommonJSResolveHack: true,
      exclude: '__tests__/**',
      clean: true,
    }),
  ],
  external: [
    '@xchainjs/xchain-client',
    "@xchainjs/xchain-crypto",
    "@xchainjs/xchain-util",
    'axios',
    'bip39',
    'bs58',
    'tweetnacl',
    'bn.js',
    'readable-stream',
    'buffer',
    'stream',
    'string_decoder',
  ],
}
