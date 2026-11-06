export interface RenderRect {
  readonly id: string;
  readonly kind: 'rect';
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly fill: string;
  readonly rotation?: number;
  readonly scaleX?: number;
  readonly scaleY?: number;
}

export interface RenderText {
  readonly id: string;
  readonly kind: 'text';
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly text: string;
  readonly color: string;
  readonly fontSize: number;
  readonly fontFamily?: string;
  readonly rotation?: number;
  readonly scaleX?: number;
  readonly scaleY?: number;
}

export type RenderObject = RenderRect | RenderText;

export interface RenderInput {
  readonly width: number;
  readonly height: number;
  readonly objects: readonly RenderObject[];
}

export interface SvgRenderOptions {
  readonly maxObjects?: number;
  readonly maxTextLength?: number;
  readonly maxOutputBytes?: number;
  readonly background?: string;
}

export class DesignRenderError extends Error {
  constructor(
    readonly code: 'invalid' | 'limit',
    message: string,
  ) {
    super(message);
    this.name = 'DesignRenderError';
  }
}

const SAFE_NAMES = new Set([
  'black',
  'white',
  'red',
  'green',
  'blue',
  'yellow',
  'orange',
  'purple',
  'pink',
  'gray',
  'grey',
  'transparent',
  'none',
]);

function number(value: unknown, name: string, positive = false): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    Math.abs(value) > Number.MAX_SAFE_INTEGER ||
    (positive && value <= 0)
  )
    throw new DesignRenderError(
      'invalid',
      `${name} must be a finite${positive ? ' positive' : ''} number.`,
    );
  return Object.is(value, -0) ? 0 : value;
}

function safeColor(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.length > 64)
    throw new DesignRenderError('invalid', `${name} must be a supported color value.`);
  const color = value.trim();
  if (
    /^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(color) ||
    SAFE_NAMES.has(color.toLowerCase()) ||
    /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/i.test(color)
  )
    return color;
  throw new DesignRenderError('invalid', `${name} must be a hex, simple rgb(a), or named color.`);
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function format(value: number): string {
  return String(Object.is(value, -0) ? 0 : value);
}

function visible(object: RenderObject, width: number, height: number): boolean {
  const centerX = object.x + object.width / 2;
  const centerY = object.y + object.height / 2;
  const angle = ((object.rotation ?? 0) * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const sx = object.scaleX ?? 1;
  const sy = object.scaleY ?? 1;
  const corners = [
    [-object.width / 2, -object.height / 2],
    [object.width / 2, -object.height / 2],
    [object.width / 2, object.height / 2],
    [-object.width / 2, object.height / 2],
  ].map(([x, y]) => {
    const scaledX = x! * sx;
    const scaledY = y! * sy;
    return [
      number(centerX + scaledX * cos - scaledY * sin, 'transformed x'),
      number(centerY + scaledX * sin + scaledY * cos, 'transformed y'),
    ];
  });
  const xs = corners.map((point) => point[0]!);
  const ys = corners.map((point) => point[1]!);
  return (
    Math.max(...xs) >= 0 &&
    Math.max(...ys) >= 0 &&
    Math.min(...xs) <= width &&
    Math.min(...ys) <= height
  );
}

export function renderDesignSvg(input: RenderInput, options: SvgRenderOptions = {}): string {
  if (!input || typeof input !== 'object' || !Array.isArray(input.objects))
    throw new DesignRenderError(
      'invalid',
      'input must contain a width, height, and objects array.',
    );
  const width = number(input.width, 'width', true);
  const height = number(input.height, 'height', true);
  const maxObjects = options.maxObjects ?? 10_000;
  const maxTextLength = options.maxTextLength ?? 100_000;
  const maxOutputBytes = options.maxOutputBytes ?? 4_194_304;
  for (const [name, value] of Object.entries({ maxObjects, maxTextLength, maxOutputBytes })) {
    if (!Number.isSafeInteger(value) || value < 1)
      throw new DesignRenderError('invalid', `${name} must be a positive safe integer.`);
  }
  if (input.objects.length > maxObjects)
    throw new DesignRenderError('limit', 'Input exceeds maxObjects.');
  const background =
    options.background === undefined ? undefined : safeColor(options.background, 'background');
  const pieces: string[] = [];
  const encoder = new TextEncoder();
  let outputBytes = 0;
  const append = (piece: string) => {
    outputBytes += encoder.encode(piece).byteLength;
    if (outputBytes > maxOutputBytes)
      throw new DesignRenderError('limit', 'Rendered SVG exceeds maxOutputBytes.');
    pieces.push(piece);
  };
  append(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${format(width)}" height="${format(height)}" viewBox="0 0 ${format(width)} ${format(height)}">`,
  );
  if (background) append(`<rect width="100%" height="100%" fill="${escapeXml(background)}"/>`);
  for (const raw of input.objects) {
    if (!raw || typeof raw !== 'object' || (raw.kind !== 'rect' && raw.kind !== 'text'))
      throw new DesignRenderError('invalid', 'Each object must have kind rect or text.');
    const object = raw;
    if (typeof object.id !== 'string' || object.id.length < 1 || object.id.length > 256)
      throw new DesignRenderError('invalid', 'object.id must contain 1..256 characters.');
    const x = number(object.x, 'x');
    const y = number(object.y, 'y');
    const objectWidth = number(object.width, 'width', true);
    const objectHeight = number(object.height, 'height', true);
    const rotation = number(object.rotation ?? 0, 'rotation');
    const scaleX = number(object.scaleX ?? 1, 'scaleX', true);
    const scaleY = number(object.scaleY ?? 1, 'scaleY', true);
    const fill = object.kind === 'rect' ? safeColor(object.fill, 'fill') : undefined;
    let textColor: string | undefined;
    let fontSize: number | undefined;
    let fontFamily: string | undefined;
    if (object.kind === 'text') {
      if (typeof object.text !== 'string' || object.text.length > maxTextLength)
        throw new DesignRenderError('limit', 'Text exceeds maxTextLength.');
      if (encoder.encode(object.text).byteLength > maxOutputBytes)
        throw new DesignRenderError('limit', 'Text exceeds maxOutputBytes.');
      textColor = safeColor(object.color, 'color');
      fontSize = number(object.fontSize, 'fontSize', true);
      fontFamily = object.fontFamily ?? 'sans-serif';
      if (typeof fontFamily !== 'string' || !/^[\w ,.-]{1,128}$/.test(fontFamily))
        throw new DesignRenderError('invalid', 'fontFamily may contain only simple family names.');
    }
    if (
      !visible(
        { ...object, x, y, width: objectWidth, height: objectHeight, rotation, scaleX, scaleY },
        width,
        height,
      )
    )
      continue;
    const centerX = number(x + objectWidth / 2, 'transformed center x');
    const centerY = number(y + objectHeight / 2, 'transformed center y');
    const transform = `translate(${format(centerX)} ${format(centerY)}) rotate(${format(rotation)}) scale(${format(scaleX)} ${format(scaleY)})`;
    if (object.kind === 'rect') {
      append(
        `<rect x="${format(-objectWidth / 2)}" y="${format(-objectHeight / 2)}" width="${format(objectWidth)}" height="${format(objectHeight)}" fill="${escapeXml(fill!)}" transform="${transform}"/>`,
      );
    } else {
      append(
        `<text x="${format(-objectWidth / 2)}" y="${format(-objectHeight / 2 + fontSize!)}" fill="${escapeXml(textColor!)}" font-size="${format(fontSize!)}" font-family="${escapeXml(fontFamily!)}" transform="${transform}">${escapeXml(object.text)}</text>`,
      );
    }
  }
  append('</svg>');
  return pieces.join('');
}
