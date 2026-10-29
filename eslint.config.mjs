import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // 데스크톱 앱의 설치 폴더와 빌드 결과.
    "desktop/node_modules/**",
    "desktop/dist/**",
  ]),
  // 데스크톱 앱 메인 프로세스는 Electron이 CommonJS로 읽는다.
  {
    files: ["desktop/**/*.js"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  // 이름 규칙(TypeScript·React 관례). 객체 속성은 외부 API·DB·HTTP 헤더가 정한 이름을 그대로 쓰므로 검사하지 않는다.
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/naming-convention": [
        "error",
        { selector: "variableLike", format: ["camelCase", "PascalCase", "UPPER_CASE"], leadingUnderscore: "allow" },
        { selector: "function", format: ["camelCase", "PascalCase"] },
        { selector: "parameter", format: ["camelCase", "PascalCase"], leadingUnderscore: "allow" },
        { selector: "typeLike", format: ["PascalCase"] },
      ],
    },
  },
]);

export default eslintConfig;
