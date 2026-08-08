import { createServer } from 'node:http';

const port = Number(process.env.MOCK_SUPABASE_PORT || 54321);
const userId = '11111111-1111-4111-8111-111111111111';
const now = new Date();

const barbers = [
  { id: '21111111-1111-4111-8111-111111111111', name: 'Daniel', aliases: [], active: true, sort_order: 10, calendar_external_id: 'daniel@example.com', telegram_chat_id: '100001', phone_e164: '+573222317169', color: '#C9A84C', created_at: now.toISOString(), updated_at: now.toISOString() },
  { id: '22222222-2222-4222-8222-222222222222', name: 'Jeisson', aliases: ['Jeison', 'Jeyson'], active: true, sort_order: 20, calendar_external_id: 'jeisson@example.com', telegram_chat_id: '100002', phone_e164: '+573001112233', color: '#4FA78D', created_at: now.toISOString(), updated_at: now.toISOString() },
  { id: '23333333-3333-4333-8333-333333333333', name: 'Anterior', aliases: [], active: false, sort_order: 30, calendar_external_id: null, telegram_chat_id: null, phone_e164: null, color: '#777777', created_at: now.toISOString(), updated_at: now.toISOString() },
];

const services = [
  { id: '31111111-1111-4111-8111-111111111111', code: 'corte', name: 'Corte Faro', aliases: [], category: 'Corte', price: 45000, duration_minutes: 45, active: true, sort_order: 10, created_at: now.toISOString(), updated_at: now.toISOString() },
  { id: '32222222-2222-4222-8222-222222222222', code: 'combo', name: 'Combo Faro', aliases: [], category: 'Combo', price: 65000, duration_minutes: 90, active: true, sort_order: 20, created_at: now.toISOString(), updated_at: now.toISOString() },
];

const clients = [
  { id: '41111111-1111-4111-8111-111111111111', full_name: 'Carlos Ramirez', phone_e164: '+573101112233', email: 'carlos@example.com', document_id: null, birth_date: '1992-05-15', address: 'Medellin', whatsapp_opt_in: true, whatsapp_opt_in_at: now.toISOString(), welcome_status: 'sent', welcome_sent_at: now.toISOString(), source: 'walk_in_bot', notes: null, created_at: now.toISOString(), updated_at: now.toISOString() },
  { id: '42222222-2222-4222-8222-222222222222', full_name: 'Mateo Gomez', phone_e164: '+573204445566', email: null, document_id: null, birth_date: null, address: null, whatsapp_opt_in: false, whatsapp_opt_in_at: null, welcome_status: 'not_requested', welcome_sent_at: null, source: 'manual', notes: 'Prefiere tijera.', created_at: now.toISOString(), updated_at: now.toISOString() },
];

const transactions = [
  { id: '51111111-1111-4111-8111-111111111111', client_id: clients[0].id, barber_id: barbers[0].id, service_id: services[0].id, amount: 45000, payment_method: 'cash', occurred_at: now.toISOString(), status: 'active', source: 'walk_in_bot', notes: null, barber_name_snapshot: 'Daniel', service_name_snapshot: 'Corte Faro', service_category_snapshot: 'Corte', created_at: now.toISOString(), client: { id: clients[0].id, full_name: clients[0].full_name, phone_e164: clients[0].phone_e164 }, barber: { id: barbers[0].id, name: barbers[0].name, color: barbers[0].color }, service: { id: services[0].id, name: services[0].name, category: services[0].category } },
];

const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
const accessToken = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: userId, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.visual-test`;
const user = { id: userId, aud: 'authenticated', role: 'authenticated', email: 'admin@lighthouse.test', email_confirmed_at: now.toISOString(), user_metadata: { full_name: 'Administrador Lighthouse' }, app_metadata: { provider: 'email' }, created_at: now.toISOString() };
const session = { access_token: accessToken, token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'visual-refresh-token', user };

function send(response, status, body, request) {
  response.writeHead(status, {
    'Access-Control-Allow-Origin': request.headers.origin || '*',
    'Access-Control-Allow-Headers': request.headers['access-control-request-headers'] || '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
    'Access-Control-Expose-Headers': 'Content-Range',
    'Content-Type': 'application/json',
  });
  response.end(body === undefined ? '' : JSON.stringify(body));
}

function restResult(pathname, url) {
  if (pathname.endsWith('/profiles')) return [{ user_id: userId, full_name: 'Administrador Lighthouse', role: 'owner', active: true }];
  if (pathname.endsWith('/barbers')) return url.searchParams.get('active') === 'eq.true' ? barbers.filter((item) => item.active) : barbers;
  if (pathname.endsWith('/services')) return url.searchParams.get('active') === 'eq.true' ? services.filter((item) => item.active) : services;
  if (pathname.endsWith('/clients')) return clients;
  if (pathname.endsWith('/service_transactions')) {
    const clientFilter = url.searchParams.get('client_id');
    return clientFilter ? transactions.filter((item) => `eq.${item.client_id}` === clientFilter) : transactions;
  }
  return [];
}

createServer((request, response) => {
  const url = new URL(request.url || '/', `http://127.0.0.1:${port}`);
  if (request.method === 'OPTIONS') return send(response, 204, undefined, request);
  if (url.pathname === '/auth/v1/token' && request.method === 'POST') return send(response, 200, session, request);
  if (url.pathname === '/auth/v1/user') return send(response, 200, user, request);
  if (url.pathname === '/auth/v1/logout') return send(response, 204, undefined, request);
  if (url.pathname === '/rest/v1/rpc/register_service_transaction') {
    return send(response, 200, { client_id: clients[0].id, client_created: false, transaction_id: transactions[0].id, transaction_created: true, welcome_queued: false }, request);
  }
  if (url.pathname === '/rest/v1/rpc/get_integration_catalog') {
    return send(response, 200, { barbers: barbers.filter((item) => item.active), services: services.filter((item) => item.active) }, request);
  }
  if (url.pathname.startsWith('/rest/v1/')) {
    const result = restResult(url.pathname, url);
    const singular = String(request.headers.accept || '').includes('application/vnd.pgrst.object+json');
    return send(response, 200, singular ? (result[0] || null) : result, request);
  }
  return send(response, 404, { message: 'Mock route not found' }, request);
}).listen(port, '127.0.0.1', () => {
  console.log(`Mock Supabase listening on http://127.0.0.1:${port}`);
});
