/** Minimal CSV reader — parses the generated datasets into arrays of objects.
 *
 *  Ported from the Express server unchanged except for dropping the fs-backed
 *  loadTable(): the browser receives each dataset as a bundled string instead
 *  of a file path. The parsing and numeric-coercion rules are identical, so a
 *  row reads the same here as it did server-side. */
function parseCSV(text) {
  const rows = [];
  let inQ = false, row = [''];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') { row[row.length - 1] += '"'; i++; }
        else inQ = false;
      } else row[row.length - 1] += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ',') row.push('');
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [''];
    } else row[row.length - 1] += ch;
  }
  if (row.length > 1 || row[0] !== '') rows.push(row);

  const headers = rows.shift();
  return rows.map((r) => {
    const o = {};
    headers.forEach((h, i) => {
      const v = r[i] ?? '';
      // Numeric coercion, but never for zero-padded ids like "007" or ISO dates.
      o[h] = v !== '' && !isNaN(v) && !/^0\d/.test(v) ? +v : v;
    });
    return o;
  });
}

export { parseCSV };
