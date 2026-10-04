// A small structural XML check for tests (no XML parser dependency): tags nest and close, and `&` is always an entity.
export function assertWellFormed(xml: string): void {
  const body = xml.replace(/^<\?xml[^>]*\?>/, '').replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '');
  if (/&(?!(amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);)/i.test(body)) throw new Error('bare & in XML');
  const stack: string[] = [];
  for (const m of body.matchAll(/<(\/?)([A-Za-z][\w:.-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>/g)) {
    const [, close, name, , selfClose] = m;
    if (selfClose) continue;
    if (!close) stack.push(name);
    else if (stack.pop() !== name) throw new Error(`unbalanced </${name}>`);
  }
  if (stack.length) throw new Error(`unclosed <${stack.at(-1)}>`);
  if (body.replace(/<[^>]*>/g, '').includes('<')) throw new Error('stray <');
}
