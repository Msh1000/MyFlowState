const js = require("@eslint/js");

module.exports = [
  js.configs.recommended,
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: {
        console: "readonly",
        exports: "writable",
        module: "readonly",
        process: "readonly",
        require: "readonly",
      },
    },
    rules: {
      "max-len": ["error", {code: 100, ignoreTemplateLiterals: true}],
      "object-curly-spacing": ["error", "never"],
      "prefer-arrow-callback": "error",
      "quotes": ["error", "double", {allowTemplateLiterals: true}],
    },
  },
];
