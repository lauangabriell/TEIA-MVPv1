import express from "express";
import multer from "multer";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { extractText, getDocumentProxy } from "unpdf";
import PDFDocument from "pdfkit";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from "docx";

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

app.post("/api/gerar-pdf", async (req, res) => {
  try {
    const { texto } = req.body;
    if (!texto) return res.status(400).json({ erro: "Texto não informado." });

    const doc = new PDFDocument({ margin: 50 });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=atividade-adaptada.pdf");

    doc.pipe(res);

    doc.fontSize(18).font("Helvetica-Bold").text("Atividade Adaptada — TEIA", { align: "center" });
    doc.moveDown(1.5);
    doc.fontSize(11).font("Helvetica");

    const linhas = texto.split("\n");
    for (const linha of linhas) {
      const limpa = linha.trim();
      if (!limpa) {
        doc.moveDown(0.4);
      } else if (
        limpa.startsWith("QUESTÃO ORIGINAL:") ||
        limpa.startsWith("VERSÃO ADAPTADA:") ||
        limpa.startsWith("ESTRATÉGIAS UTILIZADAS:")
      ) {
        doc.moveDown(0.5).font("Helvetica-Bold").text(limpa).font("Helvetica");
      } else {
        doc.text(limpa, { lineGap: 3 });
      }
    }

    doc.end();
  } catch (erro) {
    console.error("Erro ao gerar PDF:", erro);
    res.status(500).json({ erro: "Erro ao gerar PDF." });
  }
});

app.post("/api/gerar-docx", async (req, res) => {
  try {
    const { texto } = req.body;
    if (!texto) return res.status(400).json({ erro: "Texto não informado." });

    const questoes = extrairQuestoesAdaptadas(texto);

    const paragrafos = [
      new Paragraph({
        text: "Atividade Adaptada — TEIA",
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 }
      })
    ];

    questoes.forEach((q, i) => {
      paragrafos.push(
        new Paragraph({
          children: [new TextRun({ text: `Questão ${i + 1}`, bold: true, size: 24 })],
          spacing: { before: 300, after: 100 }
        })
      );

      q.split("\n").forEach(linha => {
        const limpa = linha.trim();
        if (limpa) {
          paragrafos.push(
            new Paragraph({
              children: [new TextRun({ text: limpa, size: 22 })],
              spacing: { after: 80 }
            })
          );
        }
      });
    });

    const doc = new Document({ sections: [{ children: paragrafos }] });
    const buffer = await Packer.toBuffer(doc);

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", "attachment; filename=atividade-adaptada.docx");
    res.send(buffer);
  } catch (erro) {
    console.error("Erro ao gerar DOCX:", erro);
    res.status(500).json({ erro: "Erro ao gerar DOCX." });
  }
});

function extrairQuestoesAdaptadas(texto) {
  const questoes = [];
  const blocos = texto.split(/VERSÃO ADAPTADA:/i);

  for (let i = 1; i < blocos.length; i++) {
    const conteudo = blocos[i]
      .split(/ESTRATÉGIAS UTILIZADAS:|QUESTÃO ORIGINAL:/i)[0]
      .trim();
    if (conteudo) questoes.push(conteudo);
  }

  return questoes;
}

function montarPromptFinal(promptBase, parametros, atividadeTexto) {
  return `
${promptBase}

PERFIL DO ESTUDANTE:

Série/Ano:
${parametros.serie || "Não informado"}

Disciplina:
${parametros.disciplina || "Não informado"}

Habilidade principal avaliada:
${parametros.habilidade || "Não informado"}

Nível de suporte (DSM-5-TR):
${parametros.suporte || "Não informado"}

Funções executivas observadas:
${parametros.executivas || "Não informado"}

Perfil sensorial:
${parametros.sensorial || "Não informado"}

Linguagem e comunicação:
${parametros.linguagem || "Não informado"}

Perfil pedagógico:
${parametros.pedagogico || "Não informado"}

Formato de adaptação desejado:
${parametros.formato || "Não informado"}

ATIVIDADE ORIGINAL:
${atividadeTexto || "A atividade foi enviada em arquivo anexo."}

TAREFA:
Adapte integralmente a atividade enviada respeitando o perfil completo do estudante e o formato solicitado.
`;
}

const PORTA = process.env.PORT || 3000;

app.listen(PORTA, () => {
  console.log(`Servidor rodando em http://localhost:${PORTA}`);
});