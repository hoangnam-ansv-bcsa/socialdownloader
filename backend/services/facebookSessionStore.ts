export interface FacebookHelperCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: string;
  expirationDate?: number;
}

export interface FacebookBrowserSession {
  cookies: FacebookHelperCookie[];
  userAgent?: string;
  receivedAt: number;
}

export interface FacebookPlaywrightCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  secure?: boolean;
  httpOnly?: boolean;
  expires: number;
}

let currentSession: FacebookBrowserSession | null = null;

export function setFacebookBrowserSession(
  cookies: FacebookHelperCookie[],
  userAgent?: string,
): FacebookBrowserSession {
  currentSession = {
    cookies,
    userAgent,
    receivedAt: Date.now(),
  };

  return currentSession;
}

export function getFacebookBrowserSession():
  | FacebookBrowserSession
  | null {
  return currentSession;
}

export function getFacebookPlaywrightCookies():
  FacebookPlaywrightCookie[] {
  if (!currentSession) {
    return [];
  }

  return currentSession.cookies.map((cookie) => ({
    name: cookie.name,
    value: cookie.value,
    domain: cookie.domain,
    path: cookie.path || '/',
    secure: cookie.secure,
    httpOnly: cookie.httpOnly,
    expires:
      typeof cookie.expirationDate === 'number' &&
      cookie.expirationDate > 0
        ? cookie.expirationDate
        : -1,
  }));
}
