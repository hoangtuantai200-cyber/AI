const express = require("express");
const Groq = require("groq-sdk");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
require("dotenv").config();

const app = express();

const PORT = Number(process.env.PORT) || 3000;
const MODEL = process.env.MODEL || "openai/gpt-oss-20b";
const USERS_FILE = path.join(__dirname, "users.json");

app.use(express.json({ limit: "256kb" }));
app.use(express.static(__dirname));

function readUsers() {
  try {
    if (!fs.existsSync(USERS_FILE)) {
      fs.writeFileSync(USERS_FILE, "[]", "utf8");
    }

    const data = JSON.parse(
      fs.readFileSync(USERS_FILE, "utf8")
    );

    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function writeUsers(users) {
  const temp = USERS_FILE + ".tmp";

  fs.writeFileSync(
    temp,
    JSON.stringify(users, null, 2),
    "utf8"
  );

  fs.renameSync(temp, USERS_FILE);
}

function cleanText(value, max = 10000) {
  return String(value || "")
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, max);
}

function getUser(id) {
  return readUsers().find(user => user.id === id);
}

/* =========================
   HEALTH
========================= */

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    name: "BOT NANO",
    provider: "Groq",
    model: MODEL,
    groqConfigured: Boolean(
      process.env.GROQ_API_KEY
    )
  });
});

/* =========================
   USER
========================= */

app.post("/api/user", (req, res) => {
  const name = cleanText(req.body?.name, 80);

  if (!name) {
    return res.status(400).json({
      error: "Vui lòng nhập tên."
    });
  }

  const users = readUsers();

  const user = {
    id: crypto.randomUUID(),
    name,
    createdAt: new Date().toISOString()
  };

  users.push(user);

  writeUsers(users);

  res.json(user);
});

app.get("/api/user/:id", (req, res) => {
  const user = getUser(req.params.id);

  if (!user) {
    return res.status(404).json({
      error: "Không tìm thấy người dùng."
    });
  }

  res.json(user);
});

/* =========================
   CHAT GROQ
========================= */

app.post("/api/chat", async (req, res) => {
  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({
      error: "Chưa cấu hình GROQ_API_KEY."
    });
  }

  const message = cleanText(
    req.body?.message,
    8000
  );

  const name = cleanText(
    req.body?.name,
    80
  );

  let history = Array.isArray(req.body?.history)
    ? req.body.history
    : [];

  if (!message) {
    return res.status(400).json({
      error: "Tin nhắn trống."
    });
  }

  /*
   * Chỉ gửi tối đa 12 tin gần nhất
   * để tránh vượt giới hạn token.
   */
  history = history
    .slice(-12)
    .map(item => ({
      role:
        item?.role === "assistant"
          ? "assistant"
          : "user",

      content: cleanText(
        item?.content,
        5000
      )
    }))
    .filter(item => item.content);

  const systemPrompt = `
Bạn là BOT NANO, một trợ lý AI văn bản.

Quy tắc:
- Trả lời bằng ngôn ngữ người dùng đang sử dụng.
- Trả lời tự nhiên, chính xác và hữu ích.
- Không tự nhận mình là Gemini.
- Không tự nhận mình là Claude.
- Không tự nhận mình là ChatGPT.
- Không dùng emoji nếu người dùng không yêu cầu.
- Không nói về API key hoặc cấu hình hệ thống trừ khi người dùng hỏi.
- Nếu không biết, hãy nói rõ rằng bạn không chắc chắn.
${name ? `- Tên người dùng là ${name}.` : ""}
`.trim();

  try {
    const groq = new Groq({
      apiKey: process.env.GROQ_API_KEY
    });

    const messages = [
      {
        role: "system",
        content: systemPrompt
      },
      ...history,
      {
        role: "user",
        content: message
      }
    ];

    const result =
      await groq.chat.completions.create({
        model: MODEL,
        messages,
        temperature: 0.7,
        max_tokens: 1200
      });

    const reply =
      result?.choices?.[0]?.message?.content?.trim();

    if (!reply) {
      throw new Error(
        "Groq không trả về nội dung."
      );
    }

    res.json({
      reply,
      model: MODEL
    });

  } catch (error) {
    console.error(
      "GROQ ERROR:",
      error
    );

    res.status(500).json({
      error:
        error?.error?.message ||
        error?.message ||
        "Không thể kết nối Groq."
    });
  }
});

/* =========================
   FALLBACK
========================= */

app.use((req, res) => {
  if (
    req.method === "GET" &&
    !req.path.startsWith("/api/")
  ) {
    return res.sendFile(
      path.join(__dirname, "index.html")
    );
  }

  res.status(404).json({
    error: "Not found"
  });
});

/* =========================
   START
========================= */

app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log("");
    console.log("==========================");
    console.log("       BOT NANO");
    console.log("==========================");
    console.log(
      `PORT: ${PORT}`
    );
    console.log(
      `MODEL: ${MODEL}`
    );
    console.log(
      `GROQ: ${
        process.env.GROQ_API_KEY
          ? "OK"
          : "MISSING"
      }`
    );
    console.log("==========================");
    console.log("");
  }
);