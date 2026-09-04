module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1'
  },
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  testMatch: ['<rootDir>/test/**/*.test.ts?(x)'],
  testPathIgnorePatterns: ['<rootDir>/node_modules/'],
  // @e2ee-lib packages ship raw .ts as their package "main", so ts-jest has
  // to be allowed to transform them even though they live in node_modules.
  transformIgnorePatterns: ['/node_modules/(?!.*(@e2ee-lib|@noble))'],
  transform: {
    '^.+\\.(ts|tsx|js|mjs)$': ['ts-jest', {
      tsconfig: {
        jsx: 'react-jsx',
        allowJs: true,
        // es2015 downlevels BigInt `**` into Math.pow, which throws for
        // BigInt operands — @noble/post-quantum needs real BigInt support.
        target: 'es2020',
      },
      isolatedModules: true,
    }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
};