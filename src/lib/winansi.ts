// Caracteres que admiten las fuentes estándar de los PDF (Helvetica, codificación WinAnsi / cp1252).
// Módulo puro: lo usan los PDF de las solicitudes y la validación de los textos del programa.

// Caracteres de cp1252 fuera de Latin-1 (0x80–0x9F).
const CP1252_EXTRA = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");

// Sustituciones razonables de algunos símbolos habituales que no existen en WinAnsi.
const SUSTITUTOS: Record<string, string> = {
  "≥": ">=",
  "≤": "<=",
  "≠": "!=",
  "→": "->",
  "←": "<-",
  "✓": "v",
  "✔": "v",
  "✗": "x",
  "‐": "-",
  "‑": "-",
  "−": "-",
  "′": "'",
  "″": '"',
  " ": " ",
  " ": " ",
  " ": " ",
};

export function isWinAnsiChar(ch: string): boolean {
  const c = ch.codePointAt(0)!;
  if (c === 0x0a || c === 0x09) return true;
  if (c >= 0x20 && c <= 0x7e) return true;
  if (c >= 0xa0 && c <= 0xff) return true;
  return CP1252_EXTRA.has(ch);
}

/** ¿Se puede escribir el texto tal cual en un PDF con las fuentes estándar? */
export function isWinAnsi(s: string): boolean {
  for (const ch of s) if (!isWinAnsiChar(ch)) return false;
  return true;
}

/** Caracteres del texto que no caben en un PDF (sin repetir), para explicar el error. */
export function nonWinAnsiChars(s: string): string[] {
  return [...new Set([...s].filter((ch) => !isWinAnsiChar(ch)))];
}

/** Adapta el texto para el PDF: sustituye símbolos conocidos y quita el resto (emojis, etc.). */
export function toWinAnsi(s: string): string {
  let out = "";
  for (const ch of s.normalize("NFC")) out += isWinAnsiChar(ch) ? ch : (SUSTITUTOS[ch] ?? "");
  return out;
}
