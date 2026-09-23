import { keyOf } from '../../src/model.ts';

const req = { system: 's', messages: [{ role: 'user' as const, content: 'one' }], maxTokens: 8 };
console.log(JSON.stringify({ plain: keyOf(req), judge: keyOf({ ...req, model: 'j' }) }));
