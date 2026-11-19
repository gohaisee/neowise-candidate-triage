const topicLabel = {
  delivery: "Доставка",
  pricing: "Цена",
  other: "Другое",
};

const empty = { topic: "", draft: "", notice: "" };

// Старый ответ нельзя показать поверх нового: два запроса часто возвращаются не по порядку.
export function nextScreen(screen, event) {
  if (event.requestId !== event.latestId) return screen;
  if (event.kind === "ready") {
    return { topic: event.topic, draft: event.draft, notice: "" };
  }
  if (event.kind === "invalid_input") {
    return { topic: "", draft: "", notice: "Введите текст заявки." };
  }
  return { topic: "", draft: "", notice: "Разберите заявку вручную. Черновик очищен." };
}

export function eventFromReply(requestId, latestId, body) {
  if (body?.status === "ready" && body.topic && body.draft) {
    return { requestId, latestId, kind: "ready", topic: body.topic, draft: body.draft };
  }
  if (body?.status === "invalid_input") {
    return { requestId, latestId, kind: "invalid_input" };
  }
  return { requestId, latestId, kind: "manual_review" };
}

function paint(screen) {
  const notice = document.querySelector("#notice");
  const topic = document.querySelector("#topic");
  const draft = document.querySelector("#draft");
  notice.textContent = screen.notice;
  topic.textContent = screen.topic ? topicLabel[screen.topic] || screen.topic : "";
  draft.textContent = screen.draft;
}

if (typeof document !== "undefined") {
  const form = document.querySelector("form");
  const message = document.querySelector("#message");
  let shown = empty;
  let latestId = 0;

  // Enter отправляет заявку.
  message.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    form.requestSubmit();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const requestId = ++latestId;
    let body;
    try {
      const reply = await fetch("/api/triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: message.value }),
      });
      body = await reply.json();
    } catch {
      body = null;
    }
    shown = nextScreen(shown, eventFromReply(requestId, latestId, body));
    paint(shown);
  });
}
