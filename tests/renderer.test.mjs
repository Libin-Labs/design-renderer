import test from 'node:test';
import assert from 'node:assert/strict';
import { renderDesignSvg, DesignRenderError } from '../dist/esm/index.js';

test('renders SVG elements, escapes text, applies finite transforms, and emits no browser state', () => {
  const svg = renderDesignSvg({
    width: 200,
    height: 100,
    objects: [
      {
        id: 'box',
        kind: 'rect',
        x: 10,
        y: 10,
        width: 40,
        height: 20,
        fill: '#eef',
        rotation: 30,
        scaleX: 2,
      },
      {
        id: 'label',
        kind: 'text',
        x: 20,
        y: 40,
        width: 120,
        height: 30,
        text: '<img onload="bad">&',
        color: 'black',
        fontSize: 18,
      },
    ],
  });
  assert.match(svg, /<rect/);
  assert.match(svg, /&lt;img onload=&quot;bad&quot;&gt;&amp;/);
  assert.match(svg, /rotate\(30\)/);
});

test('culls offscreen transformed geometry and supports safe background output', () => {
  const svg = renderDesignSvg(
    {
      width: 100,
      height: 100,
      objects: [
        { id: 'visible', kind: 'rect', x: 0, y: 0, width: 10, height: 10, fill: 'red' },
        { id: 'outside', kind: 'rect', x: 200, y: 200, width: 10, height: 10, fill: 'blue' },
      ],
    },
    { background: '#fff' },
  );
  assert.equal((svg.match(/<rect/g) ?? []).length, 2);
  assert.doesNotMatch(svg, /blue/);
});

test('rejects non-finite transforms, unsafe colors, and output overflows', () => {
  assert.throws(
    () =>
      renderDesignSvg({
        width: 10,
        height: 10,
        objects: [
          {
            id: 'x',
            kind: 'rect',
            x: 0,
            y: 0,
            width: 1,
            height: 1,
            fill: 'red',
            rotation: Infinity,
          },
        ],
      }),
    DesignRenderError,
  );
  assert.throws(
    () =>
      renderDesignSvg({
        width: 10,
        height: 10,
        objects: [
          { id: 'x', kind: 'rect', x: 0, y: 0, width: 1, height: 1, fill: 'url(javascript:bad)' },
        ],
      }),
    { code: 'invalid' },
  );
  assert.throws(
    () => renderDesignSvg({ width: 10, height: 10, objects: [] }, { maxOutputBytes: 10 }),
    { code: 'limit' },
  );
  assert.throws(
    () =>
      renderDesignSvg({
        width: 10,
        height: 10,
        objects: [
          {
            id: 'outside',
            kind: 'rect',
            x: 100,
            y: 100,
            width: 1,
            height: 1,
            fill: 'url(javascript:bad)',
          },
        ],
      }),
    { code: 'invalid' },
  );
  assert.throws(
    () =>
      renderDesignSvg(
        {
          width: 100,
          height: 100,
          objects: [
            { id: 'a', kind: 'rect', x: 0, y: 0, width: 10, height: 10, fill: 'red' },
            { id: 'b', kind: 'rect', x: 10, y: 10, width: 10, height: 10, fill: 'red' },
          ],
        },
        { maxOutputBytes: 200 },
      ),
    { code: 'limit' },
  );
});
