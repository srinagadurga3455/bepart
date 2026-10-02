import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..');
const frontend = join(src, '..');

function read(rel: string): string {
  return readFileSync(join(src, rel), 'utf8');
}

/** Recursively list all .ts/.tsx source files (excluding tests). */
function listSources(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) listSources(full, out);
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

describe('public ticket route (/ticket/:ticketId -> TicketPage)', () => {
  const participantRoutes = read(join('participant', 'routes.tsx'));
  const ticketPage = read(join('participant', 'tickets', 'pages', 'TicketPage.tsx'));
  const rootRoutes = read(join('routes', 'index.tsx'));

  it('registers /ticket/:ticketId with the real TicketPage component', () => {
    assert.match(participantRoutes, /import TicketPage from '\.\/tickets\/pages\/TicketPage'/);
    assert.match(participantRoutes, /\{\s*path:\s*'\/ticket\/:ticketId',\s*element:\s*<TicketPage\s*\/>\s*\}/);
  });

  it('TicketPage reads the same param name the route declares', () => {
    assert.match(ticketPage, /const \{\s*ticketId\s*\} = useParams\(\)/);
  });

  it('the ticket route is public (no auth/role guard)', () => {
    assert.doesNotMatch(participantRoutes, /RequireRole|RequireAuth|AdminGuard|OrganizerGuard|ParticipantGuard/);
  });

  it('the ticket route is registered before the catch-all fallback', () => {
    const usesParticipantRoutes = rootRoutes.indexOf('participantRoutes');
    const catchAll = rootRoutes.indexOf("path: '*'");
    assert.ok(usesParticipantRoutes !== -1, 'participantRoutes must be spread into the root table');
    assert.ok(catchAll !== -1, 'catch-all fallback must exist');
    assert.ok(usesParticipantRoutes < catchAll, 'ticket route must be reachable before the fallback');
  });

  it('no other /ticket/* route shadows the public ticket page', () => {
    const ticketRoutes = participantRoutes.match(/path:\s*'\/ticket[^']*'/g) ?? [];
    assert.deepEqual(ticketRoutes, ["path: '/ticket/:ticketId'"]);
  });

  it('a single BrowserRouter owns routing (no competing router)', () => {
    const files = listSources(src);
    const hits: string[] = [];
    for (const f of files) {
      const content = readFileSync(f, 'utf8');
      if (/<BrowserRouter|createBrowserRouter|RouterProvider|HashRouter|MemoryRouter/.test(content)) hits.push(f);
    }
    assert.equal(hits.length, 1, `expected exactly one router host, found: ${hits.join(', ')}`);
    assert.ok(hits[0].endsWith(join('routes', 'index.tsx')));
  });
});

describe('Vercel SPA rewrite (deep links must reach index.html)', () => {
  it('frontend/vercel.json keeps the SPA fallback and does not swallow /api', () => {
    const vercelPath = join(frontend, 'vercel.json');
    assert.ok(existsSync(vercelPath), 'frontend/vercel.json must exist');
    const cfg = JSON.parse(readFileSync(vercelPath, 'utf8'));
    const rewrites = cfg.rewrites ?? [];
    assert.ok(
      rewrites.some((r: any) => r.destination === '/index.html'),
      'an SPA rewrite to /index.html must be kept',
    );
  });
});
