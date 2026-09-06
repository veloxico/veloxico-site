const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const test = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const clampSource = source.slice(source.indexOf('  function clampPosition('), source.indexOf('  function positionWindow('));
const layoutSource = source.slice(source.indexOf('  function iconLayout('), source.indexOf('  function nav('));
const focusSource = source.slice(source.indexOf('  function focus(key)'), source.indexOf('  function focusNext('));
const positionSource = source.slice(source.indexOf('  function positionWindow('), source.indexOf('  function maximize('));

function setup(width, height, iconWidth = 88, iconHeight = 72) {
  const icons = Array.from({ length: 6 }, () => ({
    offsetWidth: iconWidth, offsetHeight: iconHeight, style: {}, hidden: false,
  }));
  const desktop = {
    clientWidth: width, clientHeight: height,
    querySelector: () => icons[0], querySelectorAll: () => icons,
  };
  const state = vm.createContext({ desktop, windows: new Map(), layoutMode: '', focused: '', z: 10, taskRender() {}, positionWindow() {} });
  vm.runInContext(clampSource + layoutSource + focusSource, state);
  return { state, desktop, icons };
}

test('Desktop icons remain separate and inside portrait, landscape, and wide screens', () => {
  for (const [width, height, iconWidth] of [[274, 430, 70], [344, 680, 70], [488, 540, 88], [692, 190, 88], [1280, 590, 88], [1840, 936, 88], [2500, 1250, 88]]) {
    const { state, icons } = setup(width, height, iconWidth, 77);
    state.layout();
    const rectangles = icons.map(icon => ({ x: parseFloat(icon.style.left), y: parseFloat(icon.style.top), w: icon.offsetWidth, h: icon.offsetHeight }));
    rectangles.forEach((rect, i) => {
      assert(rect.x >= 0 && rect.y >= 0 && rect.x + rect.w <= width && rect.y + rect.h <= height, `Icon ${i} outside ${width} × ${height}`);
      rectangles.slice(i + 1).forEach(other => assert(
        rect.x + rect.w <= other.x || other.x + other.w <= rect.x || rect.y + rect.h <= other.y || other.y + other.h <= rect.y,
        `Overlapping icons at ${width} × ${height}`,
      ));
    });
  }
});

test('Shorter screens reflow icon columns instead of stacking icons along the bottom', () => {
  const { state, desktop, icons } = setup(1000, 800);
  state.layout();
  desktop.clientHeight = 190;
  state.layout();
  assert.equal(new Set(icons.map(icon => `${icon.style.left},${icon.style.top}`)).size, 6);
  assert(icons.every(icon => parseFloat(icon.style.top) + icon.offsetHeight <= 190));
});

test('Window positions clamp after the desktop shrinks', () => {
  const { state } = setup(400, 300);
  const win = { hidden: false, offsetWidth: 380, offsetHeight: 280, style: { left: '1400px', top: '900px' } };
  state.clampPosition(win);
  assert.equal(win.style.left, '20px');
  assert.equal(win.style.top, '20px');
});

test('New portrait windows leave room for wrapped desktop icon labels when space allows', () => {
  const { state } = setup(344, 700, 70, 77);
  vm.runInContext(positionSource, state);
  const win = { hidden: false, offsetWidth: 330, offsetHeight: 400, style: {} };
  state.positionWindow(win);
  assert(parseFloat(win.style.top) >= 170);
  assert(parseFloat(win.style.top) + win.offsetHeight <= 700);
});

test('A minimized window keeps its position until restored, then moves inside the resized desktop', () => {
  const { state } = setup(400, 300);
  const win = { hidden: true, offsetWidth: 0, offsetHeight: 0, style: { left: '1400px', top: '900px' }, classList: { toggle() {} } };
  state.windows.set('games', win);
  state.clampPosition(win);
  assert.equal(win.style.left, '1400px');
  assert.equal(win.style.top, '900px');
  win.hidden = false; win.offsetWidth = 380; win.offsetHeight = 280;
  state.focus('games');
  assert.equal(win.style.left, '20px');
  assert.equal(win.style.top, '20px');
});

test('A resize preserves a visible window location when it still fits', () => {
  const { state, desktop } = setup(1280, 900);
  const win = { hidden: false, offsetWidth: 470, offsetHeight: 360, style: { left: '320px', top: '120px' }, dataset: {} };
  state.windows.set('projects', win);
  state.layout();
  desktop.clientWidth = 1024; desktop.clientHeight = 700;
  state.layout();
  assert.equal(win.style.left, '320px');
  assert.equal(win.style.top, '120px');
});
