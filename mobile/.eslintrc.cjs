module.exports = {
  root: true,
  parserOptions: { ecmaVersion: 2022 },
  extends: '@react-native',
  ignorePatterns: ['node_modules/', '.test-dist/', '.bundle-output/', 'dist/', 'dist-native/', 'ios/', 'android/', 'tests/'],
  rules: { 'prettier/prettier': 'off', 'react-native/no-inline-styles': 'off', 'no-void': 'off' },
};
