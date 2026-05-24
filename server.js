import express from "express";
import multer from "multer";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { extractText, getDocumentProxy } from "unpdf";

import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();
const upload = multer({ dest: "uploads/" });

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});
console.log("GEMINI_API_KEY carregada:", !!process.env.GEMINI_API_KEY);

// Armazena sessões de chat ativas: sessionId -> contents[]
const sessoes = new Map();

async function gerarComRetry(params, tentativas = 3, espera = 5000) {
  for (let i = 0; i < tentativas; i++) {
    try {
      return await ai.models.generateContent(params);
    } catch (erro) {
      const ultimo = i === tentativas - 1;
      if (ultimo || erro.status !== 503) throw erro;
      console.log(`Gemini 503 — tentativa ${i + 1}/${tentativas}, aguardando ${espera / 1000}s...`);
      await new Promise(r => setTimeout(r, espera));
    }
  }
}

app.use(cors());
app.use(express.json());
app.use(express.static(import.meta.dirname));

app.post("/api/adaptar-atividade", upload.single("arquivo"), async (req, res) => {
  try {
    const promptBase = req.body.promptBase || "";
    const parametros = JSON.parse(req.body.parametros || "{}");
    const atividadeTexto = req.body.atividadeTexto || "";

    const promptFinal = montarPromptFinal(promptBase, parametros, atividadeTexto);

    let partsPrimeiraMensagem;

    if (req.file) {
      const caminhoArquivo = path.resolve(req.file.path);
      const buffer = fs.readFileSync(caminhoArquivo);

      let textoArquivo = "";

      if (req.file.mimetype === "application/pdf") {
        const pdf = await getDocumentProxy(new Uint8Array(buffer));
        const { text } = await extractText(pdf, { mergePages: true });
        textoArquivo = text;
      } else {
        textoArquivo = buffer.toString("utf-8");
      }

      fs.unlinkSync(caminhoArquivo);

      const promptComArquivo = montarPromptFinal(promptBase, parametros, textoArquivo);
      partsPrimeiraMensagem = [{ text: promptComArquivo }];
    } else {
      partsPrimeiraMensagem = [{ text: promptFinal }];
    }

    const contents = [
      { role: "user", parts: partsPrimeiraMensagem }
    ];

    const respostaGemini = await gerarComRetry({
      model: "gemini-2.5-flash",
      contents
    });

    const textoResposta = respostaGemini.text;

    // Guarda histórico completo para continuar a conversa
    contents.push({ role: "model", parts: [{ text: textoResposta }] });

    const sessionId = randomUUID();
    sessoes.set(sessionId, contents);

    return res.json({ resposta: textoResposta, sessionId });
  } catch (erro) {
    console.error("Erro na adaptação:", erro);

    return res.status(500).json({
      erro: "Erro ao adaptar atividade com Gemini.",
      detalhe: erro.message
    });
  }
});

app.post("/api/chat-continuar", async (req, res) => {
  try {
    const { sessionId, mensagem } = req.body;

    if (!sessionId || !mensagem) {
      return res.status(400).json({ erro: "sessionId e mensagem são obrigatórios." });
    }

    const contents = sessoes.get(sessionId);

    if (!contents) {
      return res.status(404).json({ erro: "Sessão não encontrada. Envie a atividade novamente." });
    }

    contents.push({ role: "user", parts: [{ text: mensagem }] });

    const respostaGemini = await gerarComRetry({
      model: "gemini-2.5-flash",
      contents
    });

    const textoResposta = respostaGemini.text;

    contents.push({ role: "model", parts: [{ text: textoResposta }] });

    return res.json({ resposta: textoResposta });
  } catch (erro) {
    console.error("Erro na continuação do chat:", erro);

    return res.status(500).json({
      erro: "Erro ao continuar conversa com Gemini.",
      detalhe: erro.message
    });
  }
});

function montarPromptFinal(promptBase, parametros, atividadeTexto) {
  return `
${promptBase}

DADOS DO ESTUDANTE:

Série/Ano:
${parametros.serie || "Não informado"}

Disciplina:
${parametros.disciplina || "Não informado"}

Habilidade avaliada:
${parametros.habilidade || "Não informado"}

Nível de suporte:
${parametros.suporte || "Não informado"}

Características observadas:
${parametros.caracteristicas || "Não informado"}

Formato de adaptação desejado:
${parametros.formato || "Não informado"}

ATIVIDADE ORIGINAL COLADA PELO USUÁRIO:
${atividadeTexto || "A atividade foi enviada em arquivo anexo."}

TAREFA:
Adapte integralmente a atividade enviada, respeitando os dados do estudante e o formato solicitado.
`;
}

const PORTA = process.env.PORT || 3000;

app.listen(PORTA, () => {
  console.log(`Servidor rodando em http://localhost:${PORTA}`);
});