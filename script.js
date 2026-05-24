/* ======================================================
       JAVASCRIPT SIMPLES
       Aqui ficam as funções que fazem o site funcionar.
       ====================================================== */

// Mostra uma página e esconde a outra.
function mostrarPagina(nomeDaPagina) {
  document.getElementById('pagina-inicio').classList.remove('ativa');
  document.getElementById('pagina-chat').classList.remove('ativa');

  document.getElementById('pagina-' + nomeDaPagina).classList.add('ativa');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Vai para uma seção da página inicial.
function irParaSecao(idDaSecao) {
  mostrarPagina('inicio');

  setTimeout(function () {
    document.getElementById(idDaSecao).scrollIntoView({ behavior: 'smooth' });
  }, 100);
}

/* ======================================================
CHAT TEIA - ADAPTAÇÃO DE ATIVIDADES COM GEMINI
====================================================== */

const TEIA_PROMPT_BASE = `
Você é um agente especializado em adaptação de atividades, provas e questões para estudantes com TEA, educação inclusiva, acessibilidade cognitiva, neuroeducação, adaptação pedagógica e elaboração de avaliações inclusivas.

Sua função é:
1. Analisar o perfil informado do estudante.
2. Receber a atividade original enviada pelo usuário.
3. Adaptar TODAS as questões mantendo o objetivo pedagógico.
4. Reduzir barreiras cognitivas, sem infantilizar e sem reduzir drasticamente o nível pedagógico.
5. Retornar a atividade adaptada de forma clara, organizada e pronta para uso pelo professor.

REGRAS OBRIGATÓRIAS:
- Não infantilizar o conteúdo.
- Não alterar a habilidade principal avaliada.
- Não inventar informações que não estejam na atividade.
- Não excluir questões sem justificar.
- Adaptar todas as questões enviadas.
- Usar linguagem simples, direta e previsível.
- Reduzir carga cognitiva.
- Fragmentar comandos longos.
- Evitar ambiguidades.
- Organizar visualmente a resposta.

FORMATO DE RESPOSTA PARA CADA QUESTÃO:

QUESTÃO ORIGINAL:
[transcrever a questão original]

VERSÃO ADAPTADA:
[apresentar a questão adaptada]

ESTRATÉGIAS UTILIZADAS:
- simplificação textual
- apoio visual, quando adequado
- chunking
- redução de carga cognitiva
- reorganização visual
- previsibilidade
- múltipla escolha, quando adequado
- fragmentação
`;

const perguntasFluxo = [
  {
    chave: "serie",
    texto: "Qual é a série/ano do estudante?"
  },
  {
    chave: "disciplina",
    texto: `Qual é a disciplina da atividade?

1. Português
2. Matemática
3. Ciências
4. História
5. Geografia
6. Inglês
7. Outra`
  },
  {
    chave: "habilidade",
    texto: `Qual habilidade você deseja avaliar? Responda apenas com o número.

1. Leitura
2. Escrita
3. Interpretação de texto
4. Matemática básica
5. Raciocínio lógico
6. Atenção e concentração
7. Associação e classificação
8. Sequência lógica
9. Comunicação
10. Ciências
11. Outro`
  },
  {
    chave: "suporte",
    texto: `Qual nível de suporte do estudante?

1. Nível 1 — Pouco suporte
2. Nível 2 — Suporte moderado
3. Nível 3 — Muito suporte
4. Não sei informar`
  },
  {
    chave: "caracteristicas",
    texto: `Quais características você observa no estudante? Responda apenas com os números, separados por vírgula.

1. Dificuldade de atenção
2. Ansiedade
3. Sensibilidade visual
4. Sensibilidade auditiva
5. Dificuldade de interpretação
6. Literalidade
7. Hiperfoco
8. Boa memória visual
9. Dificuldade com textos longos
10. Dificuldade em abstração
11. Necessidade de rotina
12. Facilidade com imagens
13. Dificuldade social
14. Dificuldade motora
15. Necessidade de apoio visual
16. Dificuldade com perguntas abertas
17. Sobrecarga com muito texto
18. Dificuldade em múltiplas instruções
19. Processamento lento
20. Outro`
  },
  {
    chave: "formato",
    texto: `Qual formato de adaptação você deseja?

1. Mais visual
2. Mais objetiva
3. Mais simplificada
4. Com múltipla escolha
5. Com associação
6. Mista`
  }
];

let etapaAtual = 0;
let parametrosAluno = {};
let aguardandoAtividade = false;
let sessionId = null;

document.addEventListener("DOMContentLoaded", function () {
  iniciarChatTeia();

  const botaoEnviar = document.getElementById("btn-enviar-chat");
  const campoMensagem = document.getElementById("mensagem-chat");
  const botaoAnexo = document.getElementById("btn-anexo");
  const campoArquivo = document.getElementById("arquivo-atividade");
  const nomeArquivo = document.getElementById("nome-arquivo");

  if (botaoAnexo) {
    botaoAnexo.addEventListener("click", () => campoArquivo.click());
  }

  if (campoArquivo) {
    campoArquivo.addEventListener("change", function () {
      if (this.files.length > 0) {
        nomeArquivo.textContent = this.files[0].name;
      } else {
        nomeArquivo.textContent = "";
      }
    });
  }

  if (botaoEnviar) {
    botaoEnviar.addEventListener("click", enviarMensagemChat);
  }

  if (campoMensagem) {
    campoMensagem.addEventListener("keydown", function (evento) {
      if (evento.key === "Enter" && !evento.shiftKey) {
        evento.preventDefault();
        enviarMensagemChat();
      }
    });
  }
});

function iniciarChatTeia() {
  adicionarMensagemIA(
    "Olá! Vou ajudar você a adaptar uma atividade para um estudante com TEA. Primeiro, preciso entender rapidamente o perfil do aluno para gerar uma adaptação adequada."
  );

  setTimeout(() => {
    adicionarMensagemIA(perguntasFluxo[0].texto);
  }, 400);
}

function enviarMensagemChat() {
  const campoMensagem = document.getElementById("mensagem-chat");
  const campoArquivo = document.getElementById("arquivo-atividade");

  const texto = campoMensagem.value.trim();
  const arquivo = campoArquivo && campoArquivo.files.length > 0
    ? campoArquivo.files[0]
    : null;

  if (!texto && !arquivo) {
    alert("Digite uma mensagem ou envie um arquivo.");
    return;
  }

  if (texto) {
    adicionarMensagemUsuario(texto);
  }

  campoMensagem.value = "";

  if (!aguardandoAtividade) {
    registrarParametro(texto);
    return;
  }

  if (sessionId) {
    enviarMensagemContinuacao(texto);
  } else {
    enviarAtividadeParaGemini(texto, arquivo);
  }

  if (campoArquivo) {
    campoArquivo.value = "";
    const nomeArq = document.getElementById("nome-arquivo");
    if (nomeArq) nomeArq.textContent = "";
  }
}

function registrarParametro(respostaUsuario) {
  const perguntaAtual = perguntasFluxo[etapaAtual];

  parametrosAluno[perguntaAtual.chave] = respostaUsuario;

  etapaAtual++;

  if (etapaAtual < perguntasFluxo.length) {
    adicionarMensagemIA(perguntasFluxo[etapaAtual].texto);
    return;
  }

  aguardandoAtividade = true;

  adicionarMensagemIA(
    "Perfeito! Agora envie a atividade original que deseja adaptar. Você pode colar o texto no chat ou anexar um arquivo PDF, DOC, DOCX ou TXT."
  );
}

async function enviarAtividadeParaGemini(textoAtividade, arquivo) {
  adicionarMensagemIA("Recebi a atividade. Estou preparando a adaptação com base no perfil informado...");

  const formData = new FormData();

  formData.append("promptBase", TEIA_PROMPT_BASE);
  formData.append("parametros", JSON.stringify(parametrosAluno));
  formData.append("atividadeTexto", textoAtividade || "");

  if (arquivo) {
    formData.append("arquivo", arquivo);
    adicionarMensagemUsuario(`Arquivo enviado: ${arquivo.name}`);
  }

  try {
    const resposta = await fetch("/api/adaptar-atividade", {
      method: "POST",
      body: formData
    });

    if (!resposta.ok) {
      throw new Error("Erro ao chamar a API da Gemini.");
    }

    const dados = await resposta.json();

    sessionId = dados.sessionId || null;

    adicionarMensagemIA(dados.resposta || "A IA não retornou uma resposta válida.");

    if (sessionId) {
      mostrarEscolhaPosAdaptacao();
    }
  } catch (erro) {
    console.error(erro);

    adicionarMensagemIA(
      "Não consegui gerar a adaptação agora. Verifique se o servidor está rodando, se a chave da Gemini foi configurada e se o arquivo está em formato aceito."
    );
  }
}

async function enviarMensagemContinuacao(mensagem) {
  adicionarMensagemIA("Entendido! Processando sua solicitação...");

  try {
    const resposta = await fetch("/api/chat-continuar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, mensagem })
    });

    if (!resposta.ok) {
      const erro = await resposta.json();
      throw new Error(erro.erro || "Erro ao continuar conversa.");
    }

    const dados = await resposta.json();

    adicionarMensagemIA(dados.resposta || "A IA não retornou uma resposta válida.");
    mostrarEscolhaPosAdaptacao();
  } catch (erro) {
    console.error(erro);

    adicionarMensagemIA(
      "Não consegui processar sua solicitação. " + erro.message
    );
  }
}

function mostrarEscolhaPosAdaptacao() {
  const mensagens = document.getElementById("mensagens");

  mensagens.innerHTML += `
    <div class="mensagem mensagem-ia escolha-pos-adaptacao">
      <strong>TEIA:</strong><br>
      O que deseja fazer agora?<br><br>
      <div class="botoes-escolha">
        <button class="botao-escolha" onclick="mesmoPerfilNovaAtividade()">
          Adaptar outra atividade com o mesmo perfil
        </button>
        <button class="botao-escolha botao-escolha-secundario" onclick="novoPerfilNovaAtividade()">
          Novo perfil e nova atividade
        </button>
      </div>
    </div>
  `;

  rolarChatParaBaixo();
}

function mesmoPerfilNovaAtividade() {
  sessionId = null;
  adicionarMensagemUsuario("Adaptar outra atividade com o mesmo perfil");
  adicionarMensagemIA("Ótimo! Envie a nova atividade que deseja adaptar. O perfil do estudante será mantido.");
  removerBotoesEscolha();
}

function novoPerfilNovaAtividade() {
  adicionarMensagemUsuario("Novo perfil e nova atividade");
  removerBotoesEscolha();

  etapaAtual = 0;
  parametrosAluno = {};
  aguardandoAtividade = false;
  sessionId = null;

  adicionarMensagemIA("Tudo bem! Vamos começar do zero.");
  setTimeout(() => adicionarMensagemIA(perguntasFluxo[0].texto), 400);
}

function removerBotoesEscolha() {
  const escolha = document.querySelector(".escolha-pos-adaptacao");
  if (escolha) escolha.remove();
}

function adicionarMensagemUsuario(texto) {
  const mensagens = document.getElementById("mensagens");

  mensagens.innerHTML += `
    <div class="mensagem mensagem-usuario">
      <strong>Você:</strong><br>
      ${escaparHTML(texto).replace(/\n/g, "<br>")}
    </div>
  `;

  rolarChatParaBaixo();
}

function adicionarMensagemIA(texto) {
  const mensagens = document.getElementById("mensagens");

  mensagens.innerHTML += `
    <div class="mensagem mensagem-ia">
      <strong>TEIA:</strong><br>
      ${formatarRespostaIA(texto)}
    </div>
  `;

  rolarChatParaBaixo();
}

function formatarRespostaIA(texto) {
  return escaparHTML(texto)
    .replace(/\n/g, "<br>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
}

function escaparHTML(texto) {
  const div = document.createElement("div");
  div.innerText = texto;
  return div.innerHTML;
}

function rolarChatParaBaixo() {
  const mensagens = document.getElementById("mensagens");

  if (mensagens) {
    mensagens.scrollTop = mensagens.scrollHeight;
  }
}