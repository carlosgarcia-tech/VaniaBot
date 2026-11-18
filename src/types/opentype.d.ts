/**
 * opentype.d.ts
 *
 * Minimal type surface used by src/utils/devCard.ts (text → vector paths).
 * Command coordinates are declared required — devCard reads them unconditionally.
 *
 * @author **Carlos G**
 */

declare module 'opentype.js' {
  namespace opentype {
    interface PathCommand {
      type: 'M' | 'L' | 'Q' | 'C' | 'Z';
      x: number;
      y: number;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
    }

    interface Path {
      commands: PathCommand[];
    }

    interface Glyph {
      advanceWidth: number;
      getPath(x: number, y: number, fontSize: number): Path;
    }

    interface Font {
      unitsPerEm: number;
      charToGlyph(char: string): Glyph;
      getKerningValue(left: Glyph, right: Glyph): number;
    }

    function parse(buffer: ArrayBuffer): Font;
  }

  export default opentype;
}
