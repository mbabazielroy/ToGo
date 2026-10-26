// Operator "line" identity, the way transit apps colour each route: a short code
// and a colour per operator, used on badges, cards and the boarding pass. Unknown
// operators (e.g. newly created in connected mode) get a stable colour from a
// small palette so the same operator always looks the same.

export interface LineStyle { code: string; color: string; text: string }

const KNOWN: Record<string, LineStyle> = {
  op_savannah: { code: 'SAV', color: '#0c7a43', text: '#ffffff' },
  op_pearl: { code: 'PRL', color: '#1f5fd1', text: '#ffffff' },
  op_ankole: { code: 'ANK', color: '#c2410c', text: '#ffffff' },
};

const PALETTE = ['#7c3aed', '#0e7490', '#be185d', '#4d7c0f', '#b45309', '#334155'];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function lineFor(operatorId: string, operatorName?: string): LineStyle {
  const known = KNOWN[operatorId];
  if (known) return known;
  const name = (operatorName ?? operatorId).replace(/[^A-Za-z]/g, '').toUpperCase();
  return { code: (name.slice(0, 3) || 'BUS'), color: PALETTE[hash(operatorId) % PALETTE.length], text: '#ffffff' };
}
