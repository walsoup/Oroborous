const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Enable inline requires to optimize initial JS bundle size and evaluation time
config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: false,
    inlineRequires: true,
  },
});

// Configure aggressive minification for production JS bundle
config.transformer.minifierConfig = {
  compress: {
    drop_console: true,
    drop_debugger: true,
    pure_funcs: ['console.log', 'console.info', 'console.debug', 'console.warn'],
    passes: 2,
    unsafe: true,
  },
  mangle: {
    toplevel: true,
  },
  output: {
    comments: false,
  },
};

module.exports = config;
