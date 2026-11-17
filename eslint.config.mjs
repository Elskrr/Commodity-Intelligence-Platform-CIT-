import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

// eslint-config-next 16 ships native flat configs, so they are spread directly
// rather than wrapped in FlatCompat.
const eslintConfig = [
  { ignores: [".next/**", "node_modules/**", "data/**", "public-data/**"] },
  ...coreWebVitals,
  ...typescript,
];

export default eslintConfig;
