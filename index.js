import express from "express";
import axios from "axios";

const app = express();
app.use(express.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Saúde (teste rápido)
app.get("/", (req, res) => {
  res.json({ message: "IAX Bot online" });
});

// Verificação do webhook (Meta)
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// Receber mensagens
app.post("/webhook", async (req, res) => {
  try {
    const msg = req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!msg) return res.sendStatus(200);

    const from = msg.from;
    const text = msg.text?.body?.trim() || "";

    // Ignora mensagens vazias
    if (!text) return res.sendStatus(200);

    const reply = await getAIReply(text);
    await sendWhatsAppMessage(from, reply);

    return res.sendStatus(200);
  } catch (err) {
    console.error(err?.response?.data || err);
    return res.sendStatus(200);
  }
});

async function sendWhatsAppMessage(to, body) {
  await axios.post(
    `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`,
    {
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body }
    },
    { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` } }
  );
}

async function getAIReply(userText) {
  const systemPrompt = `
Você é da equipe da IAX Assessoria.
Objetivo: responder como humano, curto e profissional e conduzir o lead para qualificação.
Regras:
- Nunca diga que é IA.
- Responda a pergunta do cliente primeiro.
- Depois faça 1 pergunta objetiva para qualificar.
- Não invente preço, prazo ou garantia.
Serviços da IAX: tráfego pago, social media, edição de vídeos, criativos imersivos, sites, automação, consultoria.
Estilo: 1 a 3 linhas, linguagem natural, sem texto longo.
`.trim();

  const r = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userText }
      ],
      temperature: 0.4,
      max_tokens: 180
    },
    { headers: { Authorization: `Bearer ${OPENAI_API_KEY}` } }
  );

  return r.data.choices?.[0]?.message?.content?.trim()
    || "Perfeito 😊 Me conta um pouco mais do que você está buscando.";
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("IAX bot rodando na porta", PORT));
