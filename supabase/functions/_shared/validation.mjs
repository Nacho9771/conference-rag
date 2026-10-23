export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export function questionInput(body) {
  if (!body || typeof body.question !== 'string' || !body.question.trim() || body.question.length > 2000) {
    throw new HttpError(400, 'Enter a question between 1 and 2,000 characters.');
  }
  return body.question.trim();
}
export function contextInput(body) {
  const talks = body.context_talks;
  if (!Array.isArray(talks) || talks.length < 1 || talks.length > 3) {
    throw new HttpError(400, 'Retrieve one to three source talks before asking for an answer.');
  }
  return talks.map((t, i) => {
    if (!t || typeof t.title !== 'string' || !t.title.trim() || t.title.length > 500 ||
        typeof t.text !== 'string' || !t.text.trim() || t.text.length > 50000 ||
        (t.speaker != null && (typeof t.speaker !== 'string' || t.speaker.length > 300))) {
      throw new HttpError(400, 'A source talk is missing text or exceeds the size limit.');
    }
    return { source: i + 1, title: t.title, speaker: t.speaker || 'Unknown speaker', text: t.text };
  });
}
