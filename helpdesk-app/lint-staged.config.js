// Runs from helpdesk-app/ on every commit (see .husky/pre-commit).
// ESLint is executed inside each package so it picks up that package's config and plugins.
const quote = (files) => files.map((f) => JSON.stringify(f)).join(' ');

export default {
  'backend/**/*.js': (files) => [
    `npm --prefix backend exec -- eslint --max-warnings=0 --fix ${quote(files)}`,
    `prettier --write ${quote(files)}`,
  ],
  'frontend/**/*.{js,jsx}': (files) => [
    `npm --prefix frontend exec -- eslint --max-warnings=0 --fix ${quote(files)}`,
    `prettier --write ${quote(files)}`,
  ],
  '*.{json,yml,yaml,css}': (files) => `prettier --write ${quote(files)}`,
};
