import { renderDesignSvg, type RenderInput } from '@lp-labs/design-renderer';

const input: RenderInput = { width: 100, height: 100, objects: [] };
const svg: string = renderDesignSvg(input);
void svg;
