/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src/__tests__"],
  testMatch: ["**/*.test.ts"],
  setupFilesAfterEnv: ["<rootDir>/src/__tests__/setupEnv.ts"],
  moduleNameMapper: {
    "^@autoapply/shared$": "<rootDir>/../../packages/shared/src/index.ts"
  },
  globals: {
    "ts-jest": {
      tsconfig: "<rootDir>/tsconfig.json",
      isolatedModules: true
    }
  },
  modulePathIgnorePatterns: ["<rootDir>/dist"],
  testTimeout: 30000
};

