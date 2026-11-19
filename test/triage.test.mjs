import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import { createApp } from "../server.mjs";
import { nextScreen } from "../screen.mjs";

async function withServer(run) {
  const app = createApp();
  app.listen(0, "127.0.0.1");
  await once(app, "listening");
  try {
    await run(app.address().port);
  } finally {
    app.close();
    await once(app, "close");
  }
}

async function post(port, payload) {
  const response = await fetch(`http://127.0.0.1:${port}/api/triage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof payload === "string" ? payload : JSON.stringify(payload),
  });
  return { status: response.status, body: await response.json() };
}

test("пустой и битый ввод не уходит в модель", async () => {
  await withServer(async (port) => {
    for (const payload of ["", "{", "{}", { text: 1 }, { text: "" }, { text: "  \n" }]) {
      const reply = await post(port, payload);
      assert.equal(reply.status, 400);
      assert.deepEqual(reply.body, { status: "invalid_input" });
    }
  });
});

test("обычный текст получает тему и непустой черновик", async () => {
  await withServer(async (port) => {
    const delivery = await post(port, { text: "где доставка" });
    assert.equal(delivery.status, 200);
    assert.equal(delivery.body.status, "ready");
    assert.equal(delivery.body.topic, "delivery");
    assert.ok(delivery.body.draft.trim());

    const price = await post(port, { text: "какая цена" });
    assert.equal(price.body.topic, "pricing");
    const cost = await post(port, { text: "стоимость доставки заказа" });
    assert.equal(cost.body.topic, "pricing");

    const other = await post(port, { text: "хочу поговорить с человеком" });
    assert.equal(other.body.topic, "other");
  });
});

test("сбой модели отдаёт ручной разбор без черновика", async () => {
  await withServer(async (port) => {
    for (const text of ["[error]", "[bad-json]", "[bad-topic]", "[empty-draft] доставка"]) {
      const reply = await post(port, { text });
      assert.equal(reply.status, 200);
      assert.deepEqual(reply.body, { status: "manual_review", topic: null, draft: null });
    }

    const started = Date.now();
    const timeout = await post(port, { text: "[timeout] доставка" });
    assert.ok(Date.now() - started < 800);
    assert.deepEqual(timeout.body, { status: "manual_review", topic: null, draft: null });
  });
});

test("сбой и пустой ввод стирают прошлый черновик, опоздавший ответ нет", () => {
  const ready = { topic: "delivery", draft: "Спасибо за обращение.", notice: "" };

  const manual = nextScreen(ready, { requestId: 2, latestId: 2, kind: "manual_review" });
  assert.equal(manual.draft, "");
  assert.equal(manual.topic, "");
  assert.match(manual.notice, /вручную/);

  const empty = nextScreen(ready, { requestId: 2, latestId: 2, kind: "invalid_input" });
  assert.equal(empty.draft, "");
  assert.match(empty.notice, /Введите текст/);

  const late = nextScreen(ready, { requestId: 1, latestId: 2, kind: "manual_review" });
  assert.equal(late, ready);
});
