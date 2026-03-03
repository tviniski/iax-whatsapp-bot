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

// Receber mensagens (HÍBRIDO: regras rápidas + IA)
app.post("/webhook", async (req, res) => {
  try {
    const msg = req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!msg) return res.sendStatus(200);

    const from = msg.from;
    const textRaw = msg.text?.body || "";
    const text = textRaw.trim();

    // Ignora mensagens vazias
    if (!text) return res.sendStatus(200);

    // ===== CAMADA PRINCIPAL (REGRAS RÁPIDAS, SEM IA) =====
    const t = normalize(text);

    // 1) Saudações
    if (hasAny(t, ["oi", "ola", "olá", "bom dia", "boa tarde", "boa noite"])) {
      await sendWhatsAppMessage(
        from,
        "Oi 😊 Tudo bem? Me conta rapidinho: você quer melhorar vendas com anúncios, fortalecer sua presença nas redes, ou estruturar seu marketing (site/automação)?"
      );
      return res.sendStatus(200);
    }

    // 2) Tráfego pago / anúncios
    if (
      hasAny(t, [
        "trafego",
        "tráfego",
        "anuncio",
        "anúncio",
        "ads",
        "meta ads",
        "facebook ads",
        "instagram ads",
        "google ads",
        "campanha",
        "patrocinado",
        "impulsionar",
        "leads",
      ])
    ) {
      await sendWhatsAppMessage(
        from,
        "Sim, fazemos tráfego pago sim 👍 Você já investe em anúncios hoje ou está começando do zero?"
      );
      return res.sendStatus(200);
    }

    // 3) Social media / conteúdo / vídeos / criativos
    if (
      hasAny(t, [
        "instagram",
        "redes sociais",
        "rede social",
        "social media",
        "conteudo",
        "conteúdo",
        "video",
        "vídeo",
        "reels",
        "criativo",
        "criativos",
        "design",
        "post",
        "posts",
        "branding",
      ])
    ) {
      await sendWhatsAppMessage(
        from,
        "Perfeito 😊 Hoje você quer melhorar conteúdo e consistência nas redes, ou está buscando criativos para anúncios e conversão?"
      );
      return res.sendStatus(200);
    }

    // 4) Site / automação / estrutura
    if (
      hasAny(t, [
        "site",
        "landing",
        "landing page",
        "pagina",
        "página",
        "automacao",
        "automação",
        "funil",
        "crm",
        "whatsapp",
        "bot",
        "chatbot",
        "catalogo",
        "catálogo",
      ])
    ) {
      await sendWhatsAppMessage(
        from,
        "Entendi 😊 Isso é para estruturar seu atendimento e captação, ou você quer um site/landing para vender mais? Me diz seu segmento."
      );
      return res.sendStatus(200);
    }

    // 5) Preço / valor
    if (
      hasAny(t, [
        "quanto",
        "preco",
        "preço",
        "valor",
        "custa",
        "orcamento",
        "orçamento",
      ])
    ) {
      await sendWhatsAppMessage(
        from,
        "O investimento varia conforme objetivo e volume 😊 Pra eu te passar algo realista: qual é seu tipo de negócio e o que você quer priorizar (anúncios, redes ou estrutura)?"
      );
      return res.sendStatus(200);
    }

    // ===== CAMADA SECUNDÁRIA (IA) — só quando não encaixa nas regras =====
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
      text: { body },
    },
    { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` } }
  );
}

async function getAIReply(userText) {
  const systemPrompt = `
Você é da equipe da IAX Assessoria.
Objetivo: responder como humano, curto, consultivo e profissional, defendendo a marca IAX.
Regras:
- Nunca diga que é IA.
- Responda a pergunta do cliente primeiro.
- Depois faça 1 pergunta objetiva para qualificar.
- Não invente preço, prazo ou garantia.
Serviços da IAX: tráfego pago, social media, edição de vídeos, criativos imersivos, sites, automação, consultoria.
Estilo: 1 a 3 linhas, linguagem natural, sem textos longos, sem enrolação.
`.trim();

  const r = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userText },
      ],
      temperature: 0.4,
      max_tokens: 180,
    },
    { headers: { Authorization: `Bearer ${OPENAI_API_KEY}` } }
  );

  return (
    r.data.choices?.[0]?.message?.content?.trim() ||
    "Perfeito 😊 Me conta um pouco mais do que você está buscando."
  );
}

// Helpers
function normalize(s) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function hasAny(text, needles) {
  return needles.some((n) => text.includes(normalize(n)));
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("IAX bot rodando na porta", PORT));
