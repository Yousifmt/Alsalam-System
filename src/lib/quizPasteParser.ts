// src/lib/quizPasteParser.ts
export type ParsedOption = { label?: string; text: string; correct?: boolean };
export type Parsed = { question: string; options: ParsedOption[] };

const OPTION_PREFIX =
  /^(?:\(?\s*([A-Da-d1-9])\s*\)?[.)\-:]\s*|\s*[-•]\s+)/; // a) / A. / 1- / • ...

export function parsePasted(text: string): Parsed | null {
  const raw = text.replace(/\r/g, '').trim();

  // Look for "Answer: X" line (optional)
  let explicitAnswerLetter: string | undefined;
  const answerMatch = raw.match(/^\s*answer:\s*([A-D])\s*$/im);
  if (answerMatch) explicitAnswerLetter = answerMatch[1].toUpperCase();

  // Split lines, strip empty + "Answer:" lines
  const lines = raw
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length && !/^answer:/i.test(l));

  if (!lines.length) return null;

  // Heuristic: first non-option line is the question
  let qIndex = lines.findIndex(l => !OPTION_PREFIX.test(l));
  if (qIndex < 0) qIndex = 0;

  const question = lines[qIndex];
  const options: ParsedOption[] = [];

  for (let i = qIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!OPTION_PREFIX.test(line)) continue;

    const [, labelRaw] = line.match(/^\(?\s*([A-Da-d1-9])/) ?? [];
    const label = labelRaw?.toString().toUpperCase();

    // Remove leading "a) " / "A. " / "1- " / "• "
    let textOnly = line.replace(OPTION_PREFIX, '').trim();

    // Inline correctness markers: trailing "*" or "(correct)"
    let correct = /\*\s*$/.test(textOnly) || /\(correct\)$/i.test(textOnly);
    textOnly = textOnly.replace(/\*\s*$|\(correct\)$/i, '').trim();

    options.push({ label, text: textOnly, correct });
  }

  if (!options.length) return null;

  // If no inline marker but "Answer: B" exists, mark it
  if (explicitAnswerLetter) {
    const idx = options.findIndex(o => o.label === explicitAnswerLetter);
    if (idx >= 0) options[idx].correct = true;
  }

  return { question, options };
}
