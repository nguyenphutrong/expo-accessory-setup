module.exports = {
  preset: 'jest-expo/node',
  displayName: 'plugin',
  rootDir: __dirname,
  roots: ['<rootDir>/__tests__'],
  transform: {
    '\\.[jt]sx?$': ['babel-jest', { presets: ['babel-preset-expo'] }],
  },
};
