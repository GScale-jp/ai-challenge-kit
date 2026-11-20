const test = require('node:test');
const assert = require('node:assert');
const c = require('../src/core.js');

test('normalizeText: 前後空白除去と全角英数の半角化', () => {
  assert.strictEqual(c.normalizeText('  ＳＡＭＰＬＥ９９ \n'), 'SAMPLE99');
  assert.strictEqual(c.normalizeText(null), '');
  assert.strictEqual(c.normalizeEmail(' Ｔｅｓｔ@GMAIL.com '), 'test@gmail.com');
});

test('passphraseMatches: 全角・空白を吸収、未設定は誰も通さない', () => {
  assert.ok(c.passphraseMatches(' ＳＡＭＰＬＥ９９', 'SAMPLE99'));
  assert.ok(!c.passphraseMatches('sample99', 'SAMPLE99'));
  assert.ok(!c.passphraseMatches('', ''));
  assert.ok(!c.passphraseMatches('x', undefined));
});

test('isGmail: 個人 Gmail だけ許可', () => {
  assert.ok(c.isGmail('a.b+c_d%e-f@gmail.com'));
  assert.ok(!c.isGmail('a@gscale.jp'));
  assert.ok(!c.isGmail('a@gmail.com.evil.jp'));
  assert.ok(!c.isGmail('a@googlemail.com'));
  assert.ok(!c.isGmail('@gmail.com'));
  assert.ok(!c.isGmail('a b@gmail.com'));
});

test('isOpen: 期限前後と境界、壊れた期限は閉じる', () => {
  const dl = '2026-11-21T00:00:00+09:00';
  assert.ok(c.isOpen(new Date('2026-11-20T23:59:59+09:00'), dl));
  assert.ok(!c.isOpen(new Date('2026-11-21T00:00:00+09:00'), dl));
  assert.ok(!c.isOpen(new Date('2026-11-22T00:00:00+09:00'), dl));
  assert.ok(c.isOpen(new Date('2026-11-20T13:00:00+09:00'), undefined));
  assert.ok(!c.isOpen(new Date(), 'garbage'));
});

const rows = () => [
  { code: 'A', email: 'x@gmail.com' },
  { code: 'B', email: '' },
  { code: 'C', email: '' },
];

test('pickAssignment: 空き先頭行を割り当て', () => {
  const r = c.pickAssignment(rows(), 'new@gmail.com');
  assert.deepStrictEqual([r.kind, r.index, r.code], ['new', 1, 'B']);
});

test('pickAssignment: 同じ email には同じコード（大文字小文字は無視）', () => {
  const r = c.pickAssignment(rows(), 'x@gmail.com');
  assert.deepStrictEqual([r.kind, r.code], ['existing', 'A']);
  const r2 = c.pickAssignment([{ code: 'A', email: 'X@Gmail.com' }, { code: 'B', email: '' }], 'x@gmail.com');
  assert.strictEqual(r2.kind, 'existing');
});

test('pickAssignment: 売り切れ、既存 email は売り切れでも返す', () => {
  const full = [{ code: 'A', email: 'x@gmail.com' }, { code: 'B', email: 'y@gmail.com' }];
  assert.strictEqual(c.pickAssignment(full, 'z@gmail.com').kind, 'sold_out');
  assert.strictEqual(c.pickAssignment(full, 'y@gmail.com').code, 'B');
  assert.strictEqual(c.pickAssignment([], 'z@gmail.com').kind, 'sold_out');
});

test('countRemaining', () => {
  assert.strictEqual(c.countRemaining(rows()), 2);
});

const ctx = (o) => Object.assign({
  now: new Date('2026-11-20T14:00:00+09:00'),
  deadlineIso: '2026-11-21T00:00:00+09:00',
  passphrase: 'SAMPLE99',
  attemptsExceeded: false,
}, o);

test('validateRequest: 正常', () => {
  const v = c.validateRequest({ passphrase: 'ｋ', email: 'A@Gmail.com' }, ctx({ passphrase: 'k' }));
  assert.deepStrictEqual(v, { ok: true, email: 'a@gmail.com' });
});

test('validateRequest: 合言葉の誤り', () => {
  const v = c.validateRequest({ passphrase: 'bad', email: 'a@gmail.com' }, ctx());
  assert.strictEqual(v.error, 'bad_passphrase');
});

test('validateRequest: gmail 以外は理由つきで拒否', () => {
  const v = c.validateRequest({ passphrase: 'SAMPLE99', email: 'a@gscale.jp' }, ctx());
  assert.strictEqual(v.error, 'not_gmail');
  assert.match(c.buildError('not_gmail').message, /Workspace/);
});

test('validateRequest: 期限切れ・回数超過・不正入力', () => {
  assert.strictEqual(c.validateRequest({ passphrase: 'SAMPLE99', email: 'a@gmail.com' },
    ctx({ now: new Date('2026-11-21T00:00:01+09:00') })).error, 'closed');
  assert.strictEqual(c.validateRequest({ passphrase: 'SAMPLE99', email: 'a@gmail.com' },
    ctx({ attemptsExceeded: true })).error, 'too_many_attempts');
  assert.strictEqual(c.validateRequest(null, ctx()).error, 'bad_request');
  assert.strictEqual(c.validateRequest({ passphrase: 'SAMPLE99' }, ctx()).error, 'bad_request');
});

test('buildSuccess / buildError の形', () => {
  const s = c.buildSuccess('X', false);
  assert.deepStrictEqual(Object.keys(s), ['ok', 'code', 'already_assigned', 'redeem_url', 'deadline', 'steps']);
  assert.strictEqual(s.steps.length, 4);
  assert.strictEqual(s.redeem_url, 'https://cloud.google.com/redeem');
  assert.strictEqual(s.deadline, '2026-11-20');
  assert.strictEqual(c.buildSuccess('X', true).already_assigned, true);
  const e = c.buildError('sold_out');
  assert.strictEqual(e.ok, false);
  assert.strictEqual(e.message, '配布が終わりました。運営に声をかけてください');
});
