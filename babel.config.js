module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'module-resolver',
      {
        extensions: ['.ios.js', '.android.js', '.js', '.jsx', '.json', '.ts', '.tsx'],
        alias: {
          '@context': './src/context',
          '@imageIndex': './src/assets/imageIndex.ts',
          '@svgIndex': './src/assets/svgIndex.ts',
          '@components': './src/components/componentsIndex.ts',
          '@commonComponents': './src/components/common',
          '@card': './src/components/cardIndex.ts',
          '@hooks': './src/hooks',
          '@navigation': './src/navigation',
          '@screens': './src/screens',
          '@redux': './src/services/redux',
          '@api': './src/services/api',
          '@config': './src/services/config',
          '@theme': './src/theme',
          '@utility': './src/utility',
        },
      },
    ],
  ],
};
