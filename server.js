import express from "express";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static("public"));

const required = ["OPENAI_API_KEY", "FISH_AUDIO_API_KEY", "FISH_VOICE_ID"];
const missing = required.filter((key) => !process.env[key]);

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const SYSTEM_PROMPT = `
Você é J.A.R.V.I.S., um assistente pessoal inspirado em uma interface de inteligência artificial
futurista. Fale sempre em português brasileiro, com educação, calma, precisão e naturalidade.
Use tratamento respeitoso sem exagerar. Seja conciso por padrão. Não diga que executou ações
externas se não tiver realmente executado. Se não souber algo, seja transparente.
`;

app.get("/api/status", (_req, res) => {
  res.json({
    ready: missing.length === 0,
    missing
  });
});

app.post("/api/chat", async (req, res) => {
  try {
    if (!openai) return res.status(503).json({ error: "OPENAI_API_KEY não configurada no servidor." });
    const { message, history = [] } = req.body ?? {};
    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "Envie uma mensagem válida." });
    }

    const safeHistory = Array.isArray(history)
      ? history.slice(-10).filter(item =>
          item && ["user", "assistant"].includes(item.role) &&
          typeof item.content === "string"
        )
      : [];

    const input = [
      ...safeHistory.map(item => ({ role: item.role, content: item.content })),
      { role: "user", content: message.trim() }
    ];

    const response = await openai.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      instructions: SYSTEM_PROMPT,
      input
    });

    res.json({ reply: response.output_text || "Não consegui formular uma resposta agora." });
  } catch (error) {
    console.error("OpenAI error:", error?.message || error);
    res.status(500).json({ error: "Não consegui consultar a inteligência agora. Verifique a chave e os créditos da API." });
  }
});

app.post("/api/speak", async (req, res) => {
  try {
    if (!process.env.FISH_AUDIO_API_KEY || !process.env.FISH_VOICE_ID) {
      return res.status(503).json({ error: "Configure a chave e o Voice ID do Fish Audio no servidor." });
    }
    const { text } = req.body ?? {};
    if (typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ error: "Texto para sintetizar não informado." });
    }

    const fishResponse = await fetch("https://api.fish.audio/v1/tts", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.FISH_AUDIO_API_KEY}`,
        "Content-Type": "application/json",
        "model": "s2.1-pro"
      },
      body: JSON.stringify({
        text: text.trim().slice(0, 4000),
        reference_id: process.env.FISH_VOICE_ID,
        format: "mp3"
      })
    });

    if (!fishResponse.ok) {
      const detail = await fishResponse.text();
      console.error("Fish Audio error:", fishResponse.status, detail.slice(0, 500));
      return res.status(502).json({ error: "O Fish Audio não conseguiu gerar o áudio. Confira Voice ID, chave e saldo." });
    }

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    const audio = Buffer.from(await fishResponse.arrayBuffer());
    res.send(audio);
  } catch (error) {
    console.error("Fish Audio error:", error?.message || error);
    res.status(500).json({ error: "Falha ao gerar a voz do assistente." });
  }
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`JARVIS disponível em http://localhost:${port}`);
  if (missing.length) console.log("Variáveis ausentes:", missing.join(", "));
});
