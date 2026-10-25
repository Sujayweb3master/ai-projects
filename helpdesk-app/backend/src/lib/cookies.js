export const REFRESH_COOKIE = 'hd_rt';
export const REFRESH_COOKIE_PATH = '/api/v1/auth';

/** @param {{ secure: boolean, maxAgeMs?: number }} options */
export const refreshCookieOptions = ({ secure, maxAgeMs }) => ({
  httpOnly: true,
  secure,
  sameSite: /** @type {const} */ ('strict'),
  path: REFRESH_COOKIE_PATH,
  ...(maxAgeMs === undefined ? {} : { maxAge: maxAgeMs }),
});
