# @lp-labs/design-renderer

Browser-independent SVG generation for a deliberately small rectangle/text geometry subset. The
renderer returns SVG markup; it does not require `window`, `document`, Canvas, or an installed font.

## Install and quick start

```sh
npm install @lp-labs/design-renderer
```

```js
import { renderDesignSvg } from '@lp-labs/design-renderer';

const svg = renderDesignSvg({
  width: 320,
  height: 180,
  objects: [
    { id: 'panel', kind: 'rect', x: 0, y: 0, width: 320, height: 180, fill: '#f4f4f4' },
    {
      id: 'label',
      kind: 'text',
      x: 24,
      y: 30,
      width: 240,
      height: 40,
      text: 'A & B',
      color: '#222222',
      fontSize: 28,
    },
  ],
});
console.log(svg);
```

## API and customization

- `renderDesignSvg({ width, height, objects }, options?)` returns complete SVG source.
- Rectangles use `{ id, kind: 'rect', x, y, width, height, fill, rotation?, scaleX?, scaleY? }`.
- Text uses `{ id, kind: 'text', x, y, width, height, text, color, fontSize, fontFamily?,
rotation?, scaleX?, scaleY? }`. Rotation is degrees around object center; scales are positive.
- `SvgRenderOptions` allows `background`, `maxObjects` (10,000), `maxTextLength` (100,000), and
  `maxOutputBytes` (4 MiB). Off-viewport geometry is culled using its transformed enclosing bounds.
- All text and attribute strings are XML-escaped. Colors accept hex, simple numeric rgb(a), or a
  small named-color set; font family is restricted to simple names to avoid CSS/markup payloads.
  `DesignRenderError` reports `invalid` or `limit`. Types: `RenderRect`, `RenderText`,
  `RenderObject`, `RenderInput`, and `SvgRenderOptions`.

## Interoperability and limits

The input geometry matches the rectangle/text subset in `@lp-labs/design-document` and the object
shape from `@lp-labs/design-editor`; select a document page or map an editor snapshot before
rendering. There are no sibling dependencies. Output clips naturally to the SVG viewport. This is
not a full SVG import/export or typography engine: no paths, images, gradients, strokes, clipping,
line wrapping, shaping, or browser layout metrics. Output limits bound serialized markup; callers
must still choose appropriate storage and delivery policies for untrusted artwork.

ESM, CommonJS, and TypeScript declarations are included. CommonJS:
`const { renderDesignSvg } = require('@lp-labs/design-renderer')`. There are no runtime or peer
dependencies; TypeScript and Prettier are development-only.

## Support

If this library is useful to you, consider supporting its maintenance with a [donation via PayPal](https://www.paypal.me/LibinPrasanth).

## Author

Created by [Libin Prasanth](https://www.linkedin.com/in/libinprasanth/). Connect on LinkedIn for updates and discussion.
