import { buildTicketUrl, frontendBaseUrl, isNonPublicTicketBase, PRODUCTION_FRONTEND_URL } from './tickets.repo';

describe('tickets.repo ticket URL generation', () => {
  const prevEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...prevEnv };
  });

  it('builds canonical ticket URLs as <base>/ticket/<code>', () => {
    expect(buildTicketUrl('https://www.bepart.in/', 'abc-123')).toBe('https://www.bepart.in/ticket/abc-123');
    expect(buildTicketUrl('https://www.bepart.in', 'abc-123')).toBe('https://www.bepart.in/ticket/abc-123');
  });

  it('prefers the configured FRONTEND_URL in non-production', () => {
    process.env.NODE_ENV = 'test';
    delete process.env.FRONTEND_URL;
    expect(frontendBaseUrl('https://www.bepart.in')).toBe('https://www.bepart.in');
    expect(frontendBaseUrl('http://localhost:5173')).toBe('http://localhost:5173');
  });

  it('flags localhost, LAN IPs and backend origins as non-public', () => {
    expect(isNonPublicTicketBase('http://localhost:5173')).toBe(true);
    expect(isNonPublicTicketBase('http://127.0.0.1:3000')).toBe(true);
    expect(isNonPublicTicketBase('http://192.168.1.5:3000')).toBe(true);
    expect(isNonPublicTicketBase('http://10.0.0.2:3000')).toBe(true);
    expect(isNonPublicTicketBase('https://pravesh-server.onrender.com')).toBe(true);
    expect(isNonPublicTicketBase('https://www.bepart.in')).toBe(false);
  });

  it('never stamps localhost/LAN/backend URLs onto production tickets', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.FRONTEND_URL;
    expect(frontendBaseUrl('http://localhost:5173')).toBe(PRODUCTION_FRONTEND_URL);
    expect(frontendBaseUrl('http://192.168.1.5:5173')).toBe(PRODUCTION_FRONTEND_URL);
    expect(frontendBaseUrl('https://pravesh-server.onrender.com')).toBe(PRODUCTION_FRONTEND_URL);
    expect(frontendBaseUrl(undefined)).toBe(PRODUCTION_FRONTEND_URL);
    expect(buildTicketUrl(frontendBaseUrl('http://localhost:5173'), 'code-1')).toBe(
      `${PRODUCTION_FRONTEND_URL}/ticket/code-1`,
    );
  });

  it('respects a proper production FRONTEND_URL', () => {
    process.env.NODE_ENV = 'production';
    process.env.FRONTEND_URL = 'https://www.bepart.in';
    expect(frontendBaseUrl(undefined)).toBe('https://www.bepart.in');
    expect(buildTicketUrl(frontendBaseUrl(undefined), 'code-9')).toBe('https://www.bepart.in/ticket/code-9');
  });

  it('keeps localhost in non-production (dev/test unaffected)', () => {
    process.env.NODE_ENV = 'test';
    delete process.env.FRONTEND_URL;
    expect(frontendBaseUrl(undefined)).toBe('http://localhost:5173');
  });
});
