// Runs from helpdesk-app/ on every commit (see .husky/pre-commit).
// ESLint runs from each package (its own version + plugins) with that package's config file.
const quote = (files) => files.map((f) => JSON.stringify(f)).join(' ');

export default {
  'backend/**/*.js': (files) => [
    `npm --prefix backend exec -- eslint --config backend/eslint.config.js --max-warnings=0 --fix ${quote(files)}`,
    `prettier --write ${quote(files)}`,
  ],
  'frontend/**/*.{js,jsx}': (files) => [
    `npm --prefix frontend exec -- eslint --config frontend/eslint.config.js --max-warnings=0 --fix ${quote(files)}`,
    `prettier --write ${quote(files)}`,
  ],
  '*.{json,yml,yaml,css}': (files) => `prettier --write ${quote(files)}`,
};
