// functions/api/lab/a2ui.ts
//
// Live agent endpoint for the /lab/a2ui demo. A Workers AI model is asked to
// answer with A2UI v1.0 messages instead of prose. Every reply is validated
// against the subset of the A2UI basic catalog that the lab page can render.
//
//   POST /api/lab/a2ui  { scenario: "rebook" | "incident" | "booking" | "approve" }
//   POST /api/lab/a2ui  { prompt: "<free text, 240 chars max>" }
//     -> first turn: the model creates a surface
//
//   POST /api/lab/a2ui  { scenario|prompt, action: {...}, dataModel: {...}, components: [...] }
//     -> follow-up turn: the user pressed a button; the model updates the surface
//
// Returns { messages, source, attempts, model, latency_ms, output_chars }.
//   source = "model"      first reply was valid
//          = "corrected"  first reply failed validation; the errors were sent
//                         back once and the second reply was valid
//          = "fallback"   both replies failed (or inference failed); a stored,
//                         hand-written reply is returned so the demo never
//                         shows a broken screen. The page labels this clearly.
//
// The validator and the stored replies follow the published v1.0 schemas
// (github.com/a2ui-project/a2ui, specification/v1_0). This is a teaching
// renderer's catalog, not Google's SDK: ten components, data bindings by
// {"@path"}, no catalog functions.
//
// Uses the same Workers AI binding as /api/ask. No secret needed.

interface Env {
  AI?: { run: (model: string, input: unknown) => Promise<unknown> };
}

const MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const BASIC_CATALOG = 'https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json';
const MAX_PROMPT = 240;
const MAX_COMPONENTS = 40;

const cors: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type, accept',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...cors },
  });

// ------------------------------------------------------------------ scenarios

type Json = Record<string, unknown>;

interface Scenario {
  title: string;
  request: string;   // what the user asked
  facts: string;     // data the agent "looked up"; the model must use only this
  textReply: string; // what a text-only agent would have said (shown for contrast)
  first: Json[];     // stored fallback for the first turn
}

const v = (body: Json): Json => ({ version: '1.0', ...body });

export const SCENARIOS: Record<string, Scenario> = {
  rebook: {
    title: 'Rebook a cancelled flight',
    request: 'My flight to Cape Town was cancelled. Get me on another one today.',
    facts:
      'Cancelled: FA 204, Johannesburg (JNB) to Cape Town (CPT), 14:10 today. Seats available today: FA 212 departs 15:40 arrives 17:50, R0 extra; FA 220 departs 17:15 arrives 19:25, R0 extra; FA 236 departs 19:30 arrives 21:40, R350 credit back. Passenger: T. Mokoena, booking ref K7QX2P.',
    textReply:
      "I'm sorry your flight FA 204 was cancelled. I can see three alternatives today: FA 212 leaving at 15:40 and arriving 17:50, FA 220 leaving at 17:15 and arriving 19:25, or FA 236 leaving at 19:30 and arriving 21:40, which also gives you a R350 credit. Please reply with the flight number you would like, and then I will ask you to confirm before I change the booking.",
    first: [
      v({
        createSurface: {
          surfaceId: 'rebook',
          catalogId: BASIC_CATALOG,
          sendDataModel: true,
          components: [
            { id: 'root', component: 'Card', child: 'col' },
            { id: 'col', component: 'Column', children: ['title', 'sub', 'pick', 'actions'] },
            { id: 'title', component: 'Text', text: '### FA 204 was cancelled' },
            { id: 'sub', component: 'Text', variant: 'caption', text: 'Johannesburg to Cape Town, booking K7QX2P. Choose a replacement for today.' },
            {
              id: 'pick', component: 'ChoicePicker', label: 'Available flights', variant: 'mutuallyExclusive',
              options: [
                { label: 'FA 212 · 15:40 to 17:50 · no extra cost', value: 'FA 212' },
                { label: 'FA 220 · 17:15 to 19:25 · no extra cost', value: 'FA 220' },
                { label: 'FA 236 · 19:30 to 21:40 · R350 credit', value: 'FA 236' },
              ],
              value: { '@path': '/flight' },
            },
            { id: 'actions', component: 'Row', justify: 'end', children: ['confirm'] },
            { id: 'confirm_label', component: 'Text', text: 'Rebook me' },
            { id: 'confirm', component: 'Button', variant: 'primary', child: 'confirm_label', action: { event: { name: 'confirm_rebook', context: { flight: { '@path': '/flight' }, booking: 'K7QX2P' } } } },
          ],
          dataModel: { flight: ['FA 212'] },
        },
      }),
    ],
  },
  incident: {
    title: 'Triage a production incident',
    request: 'Checkout is failing. Show me the incident.',
    facts:
      'Incident INC-4821 "Checkout returning 502s", opened 09:42, status: unacknowledged, severity: SEV1, service: checkout-api, region: af-south. Error rate 38%, about 1,240 customers affected in the last 15 minutes. On call: N. Dlamini.',
    textReply:
      'There is an open incident, INC-4821, "Checkout returning 502s". It was opened at 09:42 and is currently SEV1 and unacknowledged. The error rate is 38% and roughly 1,240 customers have been affected in the last 15 minutes. Would you like me to acknowledge it? If so, please also tell me whether the severity should stay at SEV1 or change to SEV2 or SEV3.',
    first: [
      v({
        createSurface: {
          surfaceId: 'incident',
          catalogId: BASIC_CATALOG,
          sendDataModel: true,
          components: [
            { id: 'root', component: 'Card', child: 'col' },
            { id: 'col', component: 'Column', children: ['title', 'meta', 'div', 'stats', 'sev', 'actions'] },
            { id: 'title', component: 'Text', text: '### INC-4821 · Checkout returning 502s' },
            { id: 'meta', component: 'Text', variant: 'caption', text: { '@path': '/status' } },
            { id: 'div', component: 'Divider' },
            { id: 'stats', component: 'Row', justify: 'spaceBetween', children: ['s1', 's2'] },
            { id: 's1', component: 'Text', text: '**38%** error rate' },
            { id: 's2', component: 'Text', text: '**1,240** customers affected' },
            {
              id: 'sev', component: 'ChoicePicker', label: 'Severity', variant: 'mutuallyExclusive', displayStyle: 'chips',
              options: [{ label: 'SEV1', value: 'SEV1' }, { label: 'SEV2', value: 'SEV2' }, { label: 'SEV3', value: 'SEV3' }],
              value: { '@path': '/severity' },
            },
            { id: 'actions', component: 'Row', justify: 'end', children: ['ack', 'resolve'] },
            { id: 'ack_label', component: 'Text', text: 'Acknowledge' },
            { id: 'ack', component: 'Button', variant: 'primary', child: 'ack_label', action: { event: { name: 'acknowledge', context: { incident: 'INC-4821', severity: { '@path': '/severity' } } } } },
            { id: 'resolve_label', component: 'Text', text: 'Resolve' },
            { id: 'resolve', component: 'Button', child: 'resolve_label', action: { event: { name: 'resolve', context: { incident: 'INC-4821' } } } },
          ],
          dataModel: { status: 'Opened 09:42 · unacknowledged · checkout-api · af-south', severity: ['SEV1'] },
        },
      }),
    ],
  },
  booking: {
    title: 'Book a site visit',
    request: 'I need someone to come and look at the solar installation next week.',
    facts:
      'Customer: Karoo Farm Stall, account 30117. Technicians visit Monday to Friday, slots 08:00, 11:00 or 14:00. Earliest date 2026-11-30, latest 2026-12-04. A visit needs a contact name and a short note on the fault.',
    textReply:
      'I can book a technician visit for Karoo Farm Stall. We have slots Monday to Friday next week, from 30 November to 4 December, at 08:00, 11:00 or 14:00. Which day and time suits you? I will also need the name of the person who will be on site, and a short description of the fault.',
    first: [
      v({
        createSurface: {
          surfaceId: 'booking',
          catalogId: BASIC_CATALOG,
          sendDataModel: true,
          components: [
            { id: 'root', component: 'Card', child: 'col' },
            { id: 'col', component: 'Column', children: ['title', 'sub', 'date', 'slot', 'name', 'note', 'actions'] },
            { id: 'title', component: 'Text', text: '### Book a technician visit' },
            { id: 'sub', component: 'Text', variant: 'caption', text: 'Karoo Farm Stall · account 30117' },
            { id: 'date', component: 'DateTimeInput', label: 'Date', enableDate: true, min: '2026-11-30', max: '2026-12-04', value: { '@path': '/date' } },
            {
              id: 'slot', component: 'ChoicePicker', label: 'Arrival slot', variant: 'mutuallyExclusive', displayStyle: 'chips',
              options: [{ label: '08:00', value: '08:00' }, { label: '11:00', value: '11:00' }, { label: '14:00', value: '14:00' }],
              value: { '@path': '/slot' },
            },
            { id: 'name', component: 'TextField', label: 'Contact on site', value: { '@path': '/contact' }, placeholder: 'Name' },
            { id: 'note', component: 'TextField', label: 'What is wrong?', variant: 'longText', value: { '@path': '/note' }, placeholder: 'A short description of the fault' },
            { id: 'actions', component: 'Row', justify: 'end', children: ['book'] },
            { id: 'book_label', component: 'Text', text: 'Book visit' },
            { id: 'book', component: 'Button', variant: 'primary', child: 'book_label', action: { event: { name: 'book_visit', context: { account: '30117', date: { '@path': '/date' }, slot: { '@path': '/slot' }, contact: { '@path': '/contact' }, note: { '@path': '/note' } } } } },
          ],
          dataModel: { date: '2026-11-30', slot: ['08:00'], contact: '', note: '' },
        },
      }),
    ],
  },
  approve: {
    title: 'Approve a purchase order',
    request: 'Anything waiting for my approval?',
    facts:
      'One purchase order awaits approval: PO-2291 from Bergvliet Hardware, raised by S. Naidoo for the Paarl depot. Lines: 40 x conduit 20mm at R48.00 = R1,920.00; 12 x isolator 63A at R410.00 = R4,920.00; delivery R350.00. Total R7,190.00 excluding VAT. Budget remaining on cost centre 4410: R22,600.00.',
    textReply:
      'You have one purchase order waiting: PO-2291 from Bergvliet Hardware, raised by S. Naidoo for the Paarl depot. It covers 40 lengths of 20mm conduit at R48.00 each (R1,920.00), 12 63A isolators at R410.00 each (R4,920.00) and R350.00 delivery, for a total of R7,190.00 excluding VAT. Cost centre 4410 has R22,600.00 remaining. Reply "approve" or "reject", and add a comment if you would like one recorded.',
    first: [
      v({
        createSurface: {
          surfaceId: 'approve',
          catalogId: BASIC_CATALOG,
          sendDataModel: true,
          components: [
            { id: 'root', component: 'Card', child: 'col' },
            { id: 'col', component: 'Column', children: ['title', 'sub', 'div1', 'l1', 'l2', 'l3', 'div2', 'total', 'budget', 'comment', 'actions'] },
            { id: 'title', component: 'Text', text: '### PO-2291 · Bergvliet Hardware' },
            { id: 'sub', component: 'Text', variant: 'caption', text: 'Raised by S. Naidoo for the Paarl depot' },
            { id: 'div1', component: 'Divider' },
            { id: 'l1', component: 'Row', justify: 'spaceBetween', children: ['l1a', 'l1b'] },
            { id: 'l1a', component: 'Text', text: '40 x conduit 20mm' },
            { id: 'l1b', component: 'Text', text: 'R1,920.00' },
            { id: 'l2', component: 'Row', justify: 'spaceBetween', children: ['l2a', 'l2b'] },
            { id: 'l2a', component: 'Text', text: '12 x isolator 63A' },
            { id: 'l2b', component: 'Text', text: 'R4,920.00' },
            { id: 'l3', component: 'Row', justify: 'spaceBetween', children: ['l3a', 'l3b'] },
            { id: 'l3a', component: 'Text', text: 'Delivery' },
            { id: 'l3b', component: 'Text', text: 'R350.00' },
            { id: 'div2', component: 'Divider' },
            { id: 'total', component: 'Row', justify: 'spaceBetween', children: ['ta', 'tb'] },
            { id: 'ta', component: 'Text', text: '**Total excl. VAT**' },
            { id: 'tb', component: 'Text', text: '**R7,190.00**' },
            { id: 'budget', component: 'Text', variant: 'caption', text: 'Cost centre 4410 has R22,600.00 remaining' },
            { id: 'comment', component: 'TextField', label: 'Comment (optional)', value: { '@path': '/comment' }, placeholder: 'Recorded with the decision' },
            { id: 'actions', component: 'Row', justify: 'end', children: ['reject', 'approve'] },
            { id: 'reject_label', component: 'Text', text: 'Reject' },
            { id: 'reject', component: 'Button', child: 'reject_label', action: { event: { name: 'reject_po', context: { po: 'PO-2291', comment: { '@path': '/comment' } } } } },
            { id: 'approve_label', component: 'Text', text: 'Approve' },
            { id: 'approve', component: 'Button', variant: 'primary', child: 'approve_label', action: { event: { name: 'approve_po', context: { po: 'PO-2291', comment: { '@path': '/comment' } } } } },
          ],
          dataModel: { comment: '' },
        },
      }),
    ],
  },
};

// Stored follow-up: replace the surface with a plain confirmation of what the
// renderer sent. Used when the model's follow-up fails validation twice.
export function fallbackFollowUp(action: Json): Json[] {
  const surfaceId = String(action.surfaceId || 'main');
  const ctx = (action.context && typeof action.context === 'object' ? action.context : {}) as Json;
  const lines = Object.entries(ctx)
    .filter(([, val]) => val !== '' && val != null)
    .map(([key, val]) => `${key}: ${Array.isArray(val) ? val.join(', ') : String(val)}`);
  const components: Json[] = [
    { id: 'root', component: 'Card', child: 'done_col' },
    { id: 'done_col', component: 'Column', children: ['done_title', ...lines.map((_, i) => `done_${i}`)] },
    { id: 'done_title', component: 'Text', text: `### Done: ${String(action.name || 'action')}` },
    ...lines.map((text, i) => ({ id: `done_${i}`, component: 'Text', variant: 'caption', text })),
  ];
  return [v({ updateComponents: { surfaceId, components } })];
}

// ------------------------------------------------------------------ validator

interface A2uiError { code: 'VALIDATION_FAILED'; surfaceId: string; path: string; message: string }

const ENUMS: Record<string, Record<string, string[]>> = {
  Text: { variant: ['caption', 'body'] },
  Row: { justify: ['center', 'end', 'spaceAround', 'spaceBetween', 'spaceEvenly', 'start', 'stretch'], align: ['start', 'center', 'end', 'stretch'] },
  Column: { justify: ['start', 'center', 'end', 'spaceBetween', 'spaceAround', 'spaceEvenly', 'stretch'], align: ['center', 'end', 'start', 'stretch'] },
  Divider: { axis: ['horizontal', 'vertical'] },
  Button: { variant: ['default', 'primary', 'borderless'] },
  TextField: { variant: ['longText', 'number', 'shortText', 'obscured'] },
  ChoicePicker: { variant: ['multipleSelection', 'mutuallyExclusive'], displayStyle: ['checkbox', 'chips'] },
};
export const SUPPORTED = ['Text', 'Column', 'Row', 'Card', 'Divider', 'Button', 'TextField', 'ChoicePicker', 'DateTimeInput', 'CheckBox'];
const MESSAGE_KEYS = ['createSurface', 'updateComponents', 'updateDataModel', 'deleteSurface'];

const isObj = (x: unknown): x is Json => !!x && typeof x === 'object' && !Array.isArray(x);
const isBinding = (x: unknown) => isObj(x) && typeof x['@path'] === 'string' && (x['@path'] as string).startsWith('/') && Object.keys(x).length === 1;

export function validateMessages(messages: unknown, knownSurfaces: string[] = []): A2uiError[] {
  const errs: A2uiError[] = [];
  const err = (surfaceId: string, path: string, message: string) => {
    if (errs.length < 8) errs.push({ code: 'VALIDATION_FAILED', surfaceId, path, message });
  };
  if (!Array.isArray(messages) || !messages.length) {
    err('', '', 'Expected a non-empty JSON array of A2UI messages');
    return errs;
  }
  const surfaces = new Set(knownSurfaces);
  messages.forEach((m, mi) => {
    const mp = `/${mi}`;
    if (!isObj(m)) return err('', mp, 'Each message must be a JSON object');
    if (m.version !== '1.0') err('', `${mp}/version`, 'Every message needs "version": "1.0"');
    const keys = Object.keys(m).filter((k) => k !== 'version');
    if (keys.length !== 1 || !MESSAGE_KEYS.includes(keys[0])) {
      return err('', mp, `Each message must contain exactly one of ${MESSAGE_KEYS.join(', ')}; got ${keys.join(', ') || 'nothing'}`);
    }
    const kind = keys[0];
    const body = m[kind];
    if (!isObj(body)) return err('', `${mp}/${kind}`, `${kind} must be an object`);
    const sid = typeof body.surfaceId === 'string' ? body.surfaceId : '';
    if (!sid) return err('', `${mp}/${kind}/surfaceId`, 'surfaceId is required');
    if (kind === 'createSurface') {
      if (surfaces.has(sid)) err(sid, `${mp}/${kind}/surfaceId`, `Surface "${sid}" already exists; use updateComponents or updateDataModel`);
      surfaces.add(sid);
      if (body.catalogId !== undefined && body.catalogId !== BASIC_CATALOG) err(sid, `${mp}/${kind}/catalogId`, `catalogId must be "${BASIC_CATALOG}"`);
      if (body.dataModel !== undefined && !isObj(body.dataModel)) err(sid, `${mp}/${kind}/dataModel`, 'dataModel must be a JSON object');
      if (!Array.isArray(body.components) || !body.components.length) err(sid, `${mp}/${kind}/components`, 'createSurface must include a components array in this demo');
      else validateComponents(body.components, sid, `${mp}/${kind}/components`, err);
    } else {
      if (!surfaces.has(sid)) err(sid, `${mp}/${kind}/surfaceId`, `Unknown surface "${sid}"`);
      if (kind === 'updateComponents') {
        if (!Array.isArray(body.components) || !body.components.length) err(sid, `${mp}/${kind}/components`, 'components must be a non-empty array');
        else validateComponents(body.components, sid, `${mp}/${kind}/components`, err);
      }
      if (kind === 'updateDataModel') {
        if (!('value' in body)) err(sid, `${mp}/${kind}/value`, 'value is required (null deletes the key)');
        if (body.path !== undefined && (typeof body.path !== 'string' || !(body.path === '/' || body.path.startsWith('/')))) err(sid, `${mp}/${kind}/path`, 'path must be a JSON Pointer starting with "/"');
      }
    }
  });
  return errs;
}

function validateComponents(list: unknown[], sid: string, base: string, err: (s: string, p: string, m: string) => void) {
  if (list.length > MAX_COMPONENTS) err(sid, base, `Too many components (${list.length}); keep it under ${MAX_COMPONENTS}`);
  const ids = new Map<string, Json>();
  list.forEach((c, i) => {
    const p = `${base}/${i}`;
    if (!isObj(c)) return err(sid, p, 'Component must be an object');
    if (typeof c.id !== 'string' || !c.id) return err(sid, `${p}/id`, 'Component needs a string id');
    if (ids.has(c.id)) err(sid, `${p}/id`, `Duplicate component id "${c.id}"`);
    ids.set(c.id, c);
  });
  if (!ids.has('root')) err(sid, base, 'One component must have the id "root"');
  const dyn = (val: unknown, p: string, label: string, required: boolean, kind: 'string' | 'boolean' | 'list' = 'string') => {
    if (val === undefined) { if (required) err(sid, p, `${label} is required`); return; }
    if (isObj(val)) {
      if ('@call' in val) return err(sid, p, 'Function calls ("@call") are not supported by this renderer; use a literal or {"@path": "/..."}');
      if (!isBinding(val)) return err(sid, p, `${label} must be a literal or a data binding {"@path": "/..."}`);
      return;
    }
    if (kind === 'string' && typeof val !== 'string') err(sid, p, `Expected string or {"@path"}, got ${Array.isArray(val) ? 'array' : typeof val}`);
    if (kind === 'boolean' && typeof val !== 'boolean') err(sid, p, `Expected boolean or {"@path"}, got ${typeof val}`);
    if (kind === 'list' && !(Array.isArray(val) && val.every((x) => typeof x === 'string'))) err(sid, p, 'Expected an array of strings or {"@path"}');
  };
  const child = (val: unknown, p: string) => {
    if (typeof val !== 'string') return err(sid, p, 'Expected the id of one child component');
    if (!ids.has(val)) err(sid, p, `Child "${val}" is not defined in this message`);
  };
  list.forEach((c, i) => {
    if (!isObj(c) || typeof c.id !== 'string') return;
    const p = `${base}/${i}`;
    const type = c.component;
    if (typeof type !== 'string' || !SUPPORTED.includes(type)) {
      return err(sid, `${p}/component`, `"${String(type)}" is not in this renderer's catalog. Allowed: ${SUPPORTED.join(', ')}`);
    }
    for (const [prop, allowed] of Object.entries(ENUMS[type] || {})) {
      if (c[prop] !== undefined && !allowed.includes(c[prop] as string)) err(sid, `${p}/${prop}`, `${prop} must be one of ${allowed.join(', ')}`);
    }
    if (type === 'Text') dyn(c.text, `${p}/text`, 'text', true);
    if (type === 'Card') child(c.child, `${p}/child`);
    if (type === 'Column' || type === 'Row') {
      if (!Array.isArray(c.children)) err(sid, `${p}/children`, 'children must be an array of component ids (templates are not supported here)');
      else c.children.forEach((k, j) => child(k, `${p}/children/${j}`));
    }
    if (type === 'Button') {
      child(c.child, `${p}/child`);
      const ev = isObj(c.action) && isObj(c.action.event) ? c.action.event : null;
      if (!ev || typeof ev.name !== 'string' || !ev.name) err(sid, `${p}/action`, 'Button needs action: {"event": {"name": "...", "context": {...}}}');
      else if (ev.context !== undefined) {
        if (!isObj(ev.context)) err(sid, `${p}/action/event/context`, 'context must be an object');
        else for (const [k, val] of Object.entries(ev.context)) if (isObj(val) && !isBinding(val)) err(sid, `${p}/action/event/context/${k}`, 'Context values must be literals or {"@path": "/..."}');
      }
    }
    if (type === 'TextField') { dyn(c.label, `${p}/label`, 'label', true); dyn(c.value, `${p}/value`, 'value', true); dyn(c.placeholder, `${p}/placeholder`, 'placeholder', false); }
    if (type === 'CheckBox') { dyn(c.label, `${p}/label`, 'label', true); dyn(c.value, `${p}/value`, 'value', true, 'boolean'); }
    if (type === 'DateTimeInput') { dyn(c.value, `${p}/value`, 'value', true); dyn(c.label, `${p}/label`, 'label', false); }
    if (type === 'ChoicePicker') {
      dyn(c.label, `${p}/label`, 'label', false);
      dyn(c.value, `${p}/value`, 'value', true, 'list');
      if (!Array.isArray(c.options) || !c.options.length) err(sid, `${p}/options`, 'options must be a non-empty array of {label, value}');
      else c.options.forEach((o, j) => {
        if (!isObj(o) || typeof o.value !== 'string' || typeof o.label !== 'string') err(sid, `${p}/options/${j}`, 'Each option needs a string label and a string value');
      });
    }
  });
  // No component may contain itself.
  const seen = new Set<string>();
  const walk = (id: string, trail: string[]) => {
    if (trail.includes(id)) return err(sid, base, `Component "${id}" contains itself`);
    if (seen.has(id)) return;
    seen.add(id);
    const c = ids.get(id);
    if (!c) return;
    const kids = [c.child, ...(Array.isArray(c.children) ? c.children : [])].filter((k): k is string => typeof k === 'string');
    kids.forEach((k) => walk(k, [...trail, id]));
  };
  if (ids.has('root')) walk('root', []);
}

// ------------------------------------------------------------------ prompting

const SYSTEM = `You are an agent that answers with A2UI v1.0 messages, never with prose.
Reply with ONE JSON array of messages and nothing else: no markdown fences, no commentary.

MESSAGES (each is an object with "version": "1.0" and exactly one other key)
- {"version":"1.0","createSurface":{"surfaceId":"...","catalogId":"${BASIC_CATALOG}","sendDataModel":true,"components":[...],"dataModel":{...}}}
- {"version":"1.0","updateComponents":{"surfaceId":"...","components":[...]}}  replaces components by id on an existing surface
- {"version":"1.0","updateDataModel":{"surfaceId":"...","path":"/key","value":...}}

COMPONENTS are a FLAT list. Each has a unique "id" and a "component" type. Children are referenced by id, never nested inline. Exactly one component must have "id":"root".
Allowed types and properties (use no others):
- Text: text (required), variant "body"|"caption". Text may use "### Heading" and "**bold**".
- Column: children (array of ids), justify, align
- Row: children (array of ids), justify "start"|"center"|"end"|"spaceBetween", align
- Card: child (one id; wrap several items in a Column)
- Divider
- Button: child (id of a Text), variant "default"|"primary"|"borderless", action {"event":{"name":"snake_case_name","context":{...}}}
- TextField: label, value (required), placeholder, variant "shortText"|"longText"|"number"
- ChoicePicker: label, options [{"label":"...","value":"..."}], value (required), variant "mutuallyExclusive"|"multipleSelection", displayStyle "checkbox"|"chips"
- DateTimeInput: label, value (required, ISO 8601 or ""), enableDate, enableTime, min, max
- CheckBox: label, value (required)

DATA BINDING: a property may be a literal or {"@path":"/key"} pointing into dataModel (JSON Pointer).
- Every input's "value" MUST be a binding, and the key MUST be initialised in dataModel.
- A ChoicePicker value binds to an ARRAY of strings, e.g. dataModel {"flight":["FA 212"]}.
- Put what the agent needs in the Button's action context, using bindings for anything the user can change.
- Do not use "@call". Do not invent components, properties, facts or figures.

RULES
- Use only the facts given. South African context: rand amounts as "R1,920.00".
- Keep it to one Card, at most 25 components. One primary Button.
- Prefer inputs (pickers, fields, buttons) over asking the user to type an answer.`;

function firstTurnPrompt(request: string, facts: string): string {
  return `The user said: "${request}"\n\nFacts you looked up:\n${facts || '(none; ask for what you need with input components)'}\n\nReply with a JSON array containing one createSurface message that lets the user complete this in one screen.`;
}

function followUpPrompt(request: string, facts: string, components: unknown, dataModel: unknown, action: Json): string {
  return `Earlier the user said: "${request}"\nFacts: ${facts || '(none)'}\n\nYou rendered surface "${String(action.surfaceId)}" with these components:\n${JSON.stringify(components).slice(0, 6000)}\n\nCurrent data model: ${JSON.stringify(dataModel).slice(0, 1500)}\n\nThe renderer now reports this user action:\n${JSON.stringify({ version: '1.0', action })}\n\nCarry out the action (assume it succeeded) and reply with a JSON array holding ONE updateComponents message for surface "${String(action.surfaceId)}" that replaces the screen with a short confirmation: a new "root" Card, a heading, and the key details from the action context. Do not use createSurface.`;
}

export function extractArray(text: string): unknown {
  const cleaned = text.replace(/```(?:json)?/gi, '').trim();
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start === -1 || end <= start) {
    // A single message object is a common near-miss; accept it as a one-item array.
    const os = cleaned.indexOf('{');
    const oe = cleaned.lastIndexOf('}');
    if (os !== -1 && oe > os) { try { return [JSON.parse(cleaned.slice(os, oe + 1))]; } catch { return null; } }
    return null;
  }
  try { return JSON.parse(cleaned.slice(start, end + 1)); } catch { return null; }
}

function extractText(out: unknown): string {
  const o = out as Record<string, unknown>;
  if (!o) return '';
  if (typeof o.response === 'string') return o.response.trim();
  if (o.response && typeof o.response === 'object') return JSON.stringify(o.response);
  const choices = o.choices as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(choices) && choices[0]) {
    const msg = choices[0].message as Record<string, unknown> | undefined;
    if (msg && typeof msg.content === 'string') return msg.content.trim();
  }
  if (typeof o.result === 'string') return o.result.trim();
  return '';
}

// ------------------------------------------------------------------ handlers

// Best-effort brake per isolate. Not a real rate limit (isolates are many and
// short-lived); it only stops one tab hammering one isolate.
const hits = new Map<string, number[]>();
function tooMany(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 500) hits.clear();
  return recent.length > 12;
}

export const onRequestOptions: PagesFunction<Env> = async () => new Response(null, { status: 204, headers: cors });

export const onRequestGet: PagesFunction<Env> = async ({ env }) =>
  json({
    ok: true,
    configured: Boolean(env.AI),
    model: MODEL,
    catalog: SUPPORTED,
    scenarios: Object.fromEntries(Object.entries(SCENARIOS).map(([id, s]) => [id, { title: s.title, request: s.request, textReply: s.textReply }])),
    docs: 'https://know.2nth.ai/explainers/agents/a2ui',
  });

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: Json;
  try { body = (await request.json()) as Json; } catch { return json({ error: 'bad_json' }, 400); }

  const scenario = typeof body.scenario === 'string' ? SCENARIOS[body.scenario] : undefined;
  const prompt = typeof body.prompt === 'string' ? body.prompt.replace(/\s+/g, ' ').trim().slice(0, MAX_PROMPT) : '';
  if (!scenario && !prompt) return json({ error: 'missing_input', message: 'Send a scenario id or a prompt.' }, 400);

  const action = isObj(body.action) ? body.action : null;
  if (action && (typeof action.surfaceId !== 'string' || typeof action.name !== 'string')) return json({ error: 'bad_action' }, 400);
  const request_ = scenario ? scenario.request : prompt;
  const facts = scenario ? scenario.facts : '';
  const known = action ? [String(action.surfaceId)] : [];
  const stored = action ? fallbackFollowUp(action) : scenario ? scenario.first : null;

  const user = action
    ? followUpPrompt(request_, facts, Array.isArray(body.components) ? body.components : [], isObj(body.dataModel) ? body.dataModel : {}, action)
    : firstTurnPrompt(request_, facts);

  const attempts: Array<{ output_chars: number; errors: A2uiError[] }> = [];
  const t0 = Date.now();
  const done = (messages: unknown, source: string, note?: string) =>
    json({ messages, source, attempts, note, model: MODEL, latency_ms: Date.now() - t0, output_chars: attempts.reduce((n, a) => n + a.output_chars, 0) });

  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  if (!env.AI || tooMany(ip)) {
    const note = env.AI ? 'Too many requests from this address in the last minute.' : 'No Workers AI binding on this deployment.';
    return stored ? done(stored, 'fallback', note) : json({ error: 'unavailable', message: note }, env.AI ? 429 : 503);
  }

  const messages: Array<{ role: string; content: string }> = [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: user },
  ];

  for (let attempt = 0; attempt < 2; attempt++) {
    let text = '';
    try {
      text = extractText(await env.AI.run(MODEL, { messages, max_tokens: 1800, temperature: 0.2 }));
    } catch (e) {
      attempts.push({ output_chars: 0, errors: [{ code: 'VALIDATION_FAILED', surfaceId: '', path: '', message: `Inference failed: ${(e as Error).message}`.slice(0, 200) }] });
      break;
    }
    const parsed = extractArray(text);
    const errors = parsed === null
      ? [{ code: 'VALIDATION_FAILED' as const, surfaceId: '', path: '', message: 'Reply was not parseable JSON' }]
      : validateMessages(parsed, known);
    if (action && !errors.length && (parsed as Json[]).some((m) => 'createSurface' in m)) {
      errors.push({ code: 'VALIDATION_FAILED', surfaceId: String(action.surfaceId), path: '/0', message: 'Use updateComponents on the existing surface, not createSurface' });
    }
    attempts.push({ output_chars: text.length, errors });
    if (!errors.length) return done(parsed, attempt === 0 ? 'model' : 'corrected');
    // The spec's loop: report the validation errors back so the model can self-correct. Once.
    messages.push({ role: 'assistant', content: text.slice(0, 6000) });
    messages.push({
      role: 'user',
      content: `The renderer rejected that reply with these errors:\n${JSON.stringify(errors.map((e) => ({ version: '1.0', error: e })))}\n\nSend the corrected JSON array only.`,
    });
  }

  if (stored) return done(stored, 'fallback', 'The model did not produce a valid reply in two attempts, so this is a stored one.');
  return json({ error: 'invalid_output', message: 'The model did not produce valid A2UI for that request. Try rephrasing, or use a preset.', attempts }, 502);
};
