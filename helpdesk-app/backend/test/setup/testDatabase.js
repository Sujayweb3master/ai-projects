/** Resolve the test database URL and refuse anything that doesn't look like a throwaway DB. */
export function testDatabaseUrl() {
  const url = process.env.DATABASE_URL_TEST;
  if (!url) throw new Error('DATABASE_URL_TEST must be set to run the backend tests');
  const dbName = new URL(url).pathname.slice(1);
  if (!dbName.endsWith('_test')) {
    throw new Error(`Refusing to run tests against "${dbName}": database name must end in _test`);
  }
  return url;
}
