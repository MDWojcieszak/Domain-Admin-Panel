import {
  classifyDocument,
  contentDisposition,
  documentIdFromFile,
  documentUrlExpiry,
  isInlineSafe,
  sanitizeExtension,
  signDocument,
  titleFromName,
  verifyDocument,
} from './document-rules';

const bytes = (...values: (number | string)[]) =>
  Buffer.concat(
    values.map((v) =>
      typeof v === 'string' ? Buffer.from(v, 'latin1') : Buffer.from([v]),
    ),
  );

const PNG = bytes(0x89, 'PNG', 0x0d, 0x0a, 0x1a, 0x0a, 'rest');
const PDF = bytes('%PDF-1.7\n');
const ZIP = bytes(0x50, 0x4b, 0x03, 0x04, 'rest');

describe('classifyDocument (§4)', () => {
  it('trusts the bytes, not the name', () => {
    expect(classifyDocument(PNG, 'scan.pdf')).toMatchObject({
      kind: 'IMAGE',
      mimeType: 'image/png',
    });
    expect(classifyDocument(PDF, 'drawing')).toMatchObject({
      kind: 'PDF',
      mimeType: 'application/pdf',
    });
  });

  it('never calls HTML or SVG an image, whatever it is named', () => {
    const html = classifyDocument(bytes('<html><script>x</script>'), 'cat.png');
    expect(html.kind).toBe('TEXT');
    expect(isInlineSafe(html.kind, html.mimeType)).toBe(false);
    const svg = classifyDocument(bytes('<svg xmlns="..."/>'), 'logo.svg');
    expect(isInlineSafe(svg.kind, svg.mimeType)).toBe(false);
  });

  it('reads zip-based models and CAD files by their extension', () => {
    expect(classifyDocument(ZIP, 'mount.3mf').kind).toBe('MODEL_3D');
    expect(classifyDocument(ZIP, 'mount.f3d').kind).toBe('CAD');
    expect(classifyDocument(ZIP, 'parts.zip').kind).toBe('ARCHIVE');
    expect(classifyDocument(bytes('solid mount\n'), 'mount.STL')).toMatchObject(
      {
        kind: 'MODEL_3D',
        extension: 'stl',
        mimeType: 'application/octet-stream',
      },
    );
  });

  it('falls back to text or other', () => {
    expect(classifyDocument(bytes('G1 X10 Y10\n'), 'part.gcode').kind).toBe(
      'TEXT',
    );
    expect(classifyDocument(bytes(0, 1, 2, 3), 'blob.bin').kind).toBe('OTHER');
  });
});

describe('names', () => {
  it('keeps a plain extension or none', () => {
    expect(sanitizeExtension('Rysunek.PDF')).toBe('pdf');
    expect(sanitizeExtension('../../etc/passwd')).toBeNull();
    expect(sanitizeExtension('archive.tar.gz')).toBe('gz');
    expect(sanitizeExtension('.bashrc')).toBeNull();
    expect(sanitizeExtension('x.p/h\\p')).toBeNull();
    expect(sanitizeExtension('dir.v2/model.STEP')).toBe('step');
  });

  it('makes a title from the file name', () => {
    expect(titleFromName('mount_drawing-revB.pdf')).toBe('mount drawing revB');
  });

  it('keeps Polish names in the download', () => {
    const header = contentDisposition('attachment', 'Śruby M5 – zestaw.pdf');
    expect(header).toContain("filename*=UTF-8''%C5%9Aruby");
    expect(header).toMatch(/^attachment; filename="[\x20-\x7e]+"/);
  });
});

describe('signed URLs (D9)', () => {
  const secret = 'secret';
  const now = 1_800_000_000;

  it('verifies its own signature until it expires', () => {
    const exp = now + 60;
    const sig = signDocument(secret, 'doc', 'original', exp);
    expect(
      verifyDocument(secret, { id: 'doc', variant: 'original', exp, sig }, now),
    ).toBe(true);
    expect(
      verifyDocument(
        secret,
        { id: 'doc', variant: 'original', exp, sig },
        exp + 1,
      ),
    ).toBe(false);
  });

  it('binds the signature to the document and the variant', () => {
    const exp = now + 60;
    const sig = signDocument(secret, 'doc', 'thumb', exp);
    expect(
      verifyDocument(secret, { id: 'other', variant: 'thumb', exp, sig }, now),
    ).toBe(false);
    expect(
      verifyDocument(secret, { id: 'doc', variant: 'original', exp, sig }, now),
    ).toBe(false);
    expect(
      verifyDocument('other', { id: 'doc', variant: 'thumb', exp, sig }, now),
    ).toBe(false);
  });

  it('expires 60 to 90 minutes out, on a half-hour grid', () => {
    for (const t of [now, now + 1, now + 1799]) {
      const exp = documentUrlExpiry(t);
      expect(exp % 1800).toBe(0);
      expect(exp - t).toBeGreaterThanOrEqual(3600);
      expect(exp - t).toBeLessThanOrEqual(5400);
    }
  });
});

describe('documentIdFromFile (upkeep)', () => {
  const id = '0f8fad5b-d9cb-469f-a165-70867728950e';

  it('reads the id from the names the library writes', () => {
    expect(documentIdFromFile('original', `${id}.pdf`)).toBe(id);
    expect(documentIdFromFile('original', id)).toBe(id);
    expect(documentIdFromFile('preview', `${id}-thumb.webp`)).toBe(id);
    expect(documentIdFromFile('preview', `${id}-large.webp`)).toBe(id);
  });

  it('ignores anything else, so it is never deleted by mistake', () => {
    expect(documentIdFromFile('original', '.gitkeep')).toBeNull();
    expect(documentIdFromFile('original', `${id}-thumb.webp`)).toBeNull();
    expect(documentIdFromFile('preview', `${id}.webp`)).toBeNull();
    expect(documentIdFromFile('original', `notes-${id}.txt`)).toBeNull();
    expect(documentIdFromFile('preview', `${id}-thumbXwebp`)).toBeNull();
    expect(documentIdFromFile('original', `${id}Xpdf`)).toBeNull();
  });
});
