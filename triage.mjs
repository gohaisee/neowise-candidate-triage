import { classify } from "./mock-ai.mjs";

const topics = new Set(["delivery", "pricing", "other"]);
const modelWaitMs = 300;

function manualReview() {
  return { http: 200, body: { status: "manual_review", topic: null, draft: null } };
}

function invalidInput() {
  return { http: 400, body: { status: "invalid_input" } };
}

// Пробелы — не заявка: иначе модель ответит не про тот текст, а менеджер увидит готовый черновик.
function requestText(raw) {
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return "";
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return "";
  if (typeof body.text !== "string") return "";
  return body.text.trim();
}

// Имитатор может ответить без исключения и всё равно отдать чужую тему или черновик из пробелов.
export function interpretModel(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return manualReview();
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return manualReview();
  const draft = typeof parsed.draft === "string" ? parsed.draft.trim() : "";
  if (!topics.has(parsed.topic) || !draft) return manualReview();
  return { http: 200, body: { status: "ready", topic: parsed.topic, draft } };
}

export async function triage(raw, ask = classify) {
  const text = requestText(raw);
  if (!text) return invalidInput();

  let modelRaw;
  try {
    modelRaw = await ask(text, { signal: AbortSignal.timeout(modelWaitMs) });
  } catch {
    return manualReview();
  }
  if (typeof modelRaw !== "string") return manualReview();
  return interpretModel(modelRaw);
}
