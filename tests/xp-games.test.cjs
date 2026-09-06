const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(require('node:path').join(__dirname, '../index.html'), 'utf8');
for (const [, script] of source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) new vm.Script(script);
const core = source.split('// BEGIN PURE GAME CORE')[1].split('// END PURE GAME CORE')[0];
const c = vm.runInNewContext(core + '\ngameCore');
let count = 0;
function test(name, fn) { fn(); count++; console.log('PASS', name); }
function seeded(seed) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }

test('Minesweeper: all 25 opening cells are safe across 50 boards each', () => {
  for (let seed = 0; seed < 50; seed++) for (let i = 0; i < 25; i++) {
    const s = c.mineNew(); c.mineReveal(s, i, seeded(seed));
    assert.equal(s.lost, false); assert.equal(s.mines.size, 4);
    assert.equal(s.counts[i], 0); assert(s.revealed.has(i));
    for (const cell of s.revealed) assert(!s.mines.has(cell));
  }
});
test('Minesweeper: flags protect cells, cap at four, and toggle', () => {
  const s = c.mineNew(); for (let i = 0; i < 5; i++) c.mineFlag(s, i);
  assert.equal(s.flags.size, 4); c.mineReveal(s, 0); assert.equal(s.planted, false);
  c.mineFlag(s, 0); assert.equal(s.flags.size, 3); c.mineReveal(s, 0, seeded(8)); assert(s.revealed.has(0));
});
test('Minesweeper: revealing all safe cells wins and completed boards stop', () => {
  const s = c.mineNew(); c.mineReveal(s, 12, seeded(3));
  for (let i = 0; i < 25; i++) if (!s.mines.has(i)) c.mineReveal(s, i);
  assert(s.won); assert.equal(s.revealed.size, 21);
  c.mineReveal(s, [...s.mines][0]); assert.equal(s.lost, false);
});
test('Minesweeper: a later mine loses and blocks further reveal', () => {
  const s = c.mineNew(); c.mineReveal(s, 0, seeded(4)); c.mineReveal(s, [...s.mines][0]);
  assert(s.lost); const n = s.revealed.size;
  for (let i = 0; i < 25; i++) c.mineReveal(s, i); assert.equal(s.revealed.size, n);
});
test('Snake: cannot reverse, does not tick while paused, and loses at wall', () => {
  const s = c.snakeNew(seeded(3)); c.snakeTurn(s, {x:-1,y:0}); assert.equal(s.next.x,1);
  c.snakeStep(s); assert.equal(s.body[0].x,4); s.status='running'; s.food={x:0,y:0};
  for(let i=0;i<16;i++) c.snakeStep(s); assert.equal(s.status,'lost');
});
test('Snake: vacating the tail is allowed but entering its body loses', () => {
  const s=c.snakeNew(); s.body=[{x:1,y:1},{x:1,y:2},{x:0,y:2},{x:0,y:1}];
  s.status='running'; s.next={x:-1,y:0}; s.food={x:8,y:8}; c.snakeStep(s);
  assert.equal(s.status,'running'); assert.equal(s.body[0].x,0);
  s.next={x:1,y:0}; c.snakeStep(s); assert.equal(s.status,'lost');
});
test('Snake: eating grows, score increments, fifth packet wins', () => {
  const s=c.snakeNew(); s.status='running';
  for(let i=0;i<5;i++) { s.food={x:s.body[0].x+1,y:s.body[0].y}; c.snakeStep(s,seeded(i)); }
  assert.equal(s.score,5); assert.equal(s.body.length,8); assert.equal(s.status,'won');
});
test('Icon Match: no duplicate-card credit and mismatches lock until cleared', () => {
  const s=c.memoryNew(seeded(2)); assert.equal(c.memoryPick(s,0),'first'); assert.equal(c.memoryPick(s,0),'ignored');
  const i=s.cards.findIndex(n=>n!==s.cards[0]); assert.equal(c.memoryPick(s,i),'mismatch');
  assert.equal(c.memoryPick(s,11),'ignored'); assert.equal(s.moves,1); c.memoryClear(s); assert.equal(s.locked,false);
});
test('Icon Match: six pairs win exactly once', () => {
  const s=c.memoryNew(seeded(8)); let result;
  for(let value=0;value<6;value++) { const a=s.cards.map((v,i)=>v===value?i:-1).filter(i=>i>=0); c.memoryPick(s,a[0]); result=c.memoryPick(s,a[1]); }
  assert.equal(result,'won'); assert.equal(s.moves,6); assert.equal(s.matched.size,6); assert.equal(c.memoryPick(s,0),'ignored');
});
console.log(`${count} game-engine checks passed.`);
