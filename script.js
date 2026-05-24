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
  // Mostra a página início sem rolar para o topo
  document.getElementById('pagina-inicio').classList.add('ativa');
  document.getElementById('pagina-chat').classList.remove('ativa');

  setTimeout(function () {
    document.getElementById(idDaSecao).scrollIntoView({ behavior: 'smooth' });
  }, 50);
}

/* ======================================================
CHAT TEIA - ADAPTAÇÃO DE ATIVIDADES COM GEMINI
====================================================== */

const TEIA_PROMPT_BASE = `
Você é um agente especializado em adaptação pedagógica inclusiva para estudantes com TEA.

Sua função é adaptar atividades mantendo o objetivo pedagógico original, reduzindo barreiras cognitivas e promovendo acessibilidade educacional.

O sistema considera:
- funções executivas;
- perfil sensorial;
- linguagem e comunicação;
- necessidade de suporte;
- perfil pedagógico;
- acessibilidade cognitiva.

As adaptações são fundamentadas em:
- educação inclusiva;
- neuroeducação;
- funções executivas;
- metodologia TEACCH;
- acessibilidade cognitiva;
- ABA;
- DSM-5-TR.

REGRAS OBRIGATÓRIAS:
- não infantilizar;
- não alterar a habilidade principal;
- não remover conteúdo pedagógico essencial;
- usar linguagem clara, objetiva e previsível;
- reduzir carga cognitiva;
- fragmentar instruções longas;
- evitar ambiguidades;
- melhorar organização visual;
- adaptar TODAS as questões.

REGRAS DE ADAPTAÇÃO BASEADAS NO PERFIL:

Se houver dificuldade de atenção:
- usar frases curtas;
- destacar informações importantes;
- reduzir distrações textuais.

Se houver processamento lento:
- dividir comandos em etapas menores;
- reduzir excesso de informação por bloco.

Se houver dificuldade com múltiplas instruções:
- apresentar uma instrução por vez.

Se houver literalidade:
- evitar linguagem figurada;
- usar linguagem objetiva e explícita.

Se houver dificuldade de interpretação:
- simplificar estruturas complexas;
- explicitar contexto e objetivo.

Se houver dificuldade com perguntas abertas:
- priorizar múltipla escolha;
- associação;
- respostas guiadas.

Se houver sensibilidade visual:
- reduzir poluição visual.

Se houver sobrecarga com muito texto:
- reduzir densidade textual;
- usar espaçamento;
- organizar em tópicos.

Se houver necessidade de apoio visual:
- usar tabelas;
- separações visuais;
- organização em blocos.

Se houver dificuldade em abstração:
- utilizar exemplos concretos;
- contextualização prática.

REGRAS DE FORMATAÇÃO:
- não usar markdown;
- não usar asteriscos, negrito, itálico ou qualquer símbolo de formatação;
- usar apenas texto simples e quebras de linha;
- o texto será exportado diretamente para PDF e DOCX.

FORMATO DE RESPOSTA PARA CADA QUESTÃO:

QUESTÃO ORIGINAL:
[transcrever]

VERSÃO ADAPTADA:
[adaptar]

ESTRATÉGIAS UTILIZADAS:
- simplificação textual
- chunking
- previsibilidade
- apoio visual
- reorganização visual
- redução de carga cognitiva
- linguagem objetiva
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
    texto: `Qual habilidade principal deseja avaliar? Responda apenas com o número.

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
11. Outra`
  },
  {
    chave: "suporte",
    texto: `Qual nível de suporte do estudante?

1. Nível 1 — necessita pouco suporte
2. Nível 2 — necessita suporte moderado
3. Nível 3 — necessita suporte substancial
4. Não sei informar`
  },
  {
    chave: "executivas",
    texto: `Quais características cognitivas você observa no estudante?

Responda apenas com os números separados por vírgula.

1. Dificuldade de atenção sustentada
2. Processamento lento
3. Dificuldade com múltiplas instruções
4. Necessidade de previsibilidade e rotina
5. Dificuldade de organização
6. Dificuldade em iniciar tarefas
7. Rigidez cognitiva
8. Hiperfoco
9. Não observo dificuldades significativas`
  },
  {
    chave: "sensorial",
    texto: `Quais características sensoriais você observa?

Responda apenas com os números separados por vírgula.

1. Sensibilidade auditiva
2. Sensibilidade visual
3. Sensibilidade tátil
4. Sobrecarga com muito texto
5. Distração fácil com estímulos visuais
6. Necessidade de ambiente mais organizado visualmente
7. Não observo dificuldades sensoriais relevantes`
  },
  {
    chave: "linguagem",
    texto: `Quais características de linguagem e comunicação você observa?

Responda apenas com os números separados por vírgula.

1. Dificuldade de interpretação
2. Interpretação literal
3. Dificuldade com perguntas abertas
4. Melhor compreensão com linguagem objetiva
5. Dificuldade em identificar ideias principais
6. Dificuldade social na comunicação
7. Não observo dificuldades relevantes`
  },
  {
    chave: "pedagogico",
    texto: `Quais características de aprendizagem você observa?

Responda apenas com os números separados por vírgula.

1. Facilidade com imagens
2. Boa memória visual
3. Necessidade de apoio visual
4. Dificuldade com textos longos
5. Dificuldade em abstração
6. Melhor aprendizagem com exemplos concretos
7. Melhor desempenho com organização visual
8. Não observo dificuldades pedagógicas relevantes`
  },
  {
    chave: "formato",
    texto: `Qual formato de adaptação deseja priorizar?

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

function mostrarCarregando() {
  const mensagens = document.getElementById("mensagens");
  mensagens.innerHTML += `
    <div class="mensagem mensagem-ia" id="msg-carregando">
      <div class="carregando-wrapper">
        <img src="TEIA_icone_app_512x512.png" class="logo-girando" alt="carregando" />
        <p class="carregando-texto">Adaptando<span>.</span><span>.</span><span>.</span></p>
      </div>
    </div>
  `;
  rolarChatParaBaixo();
}

function esconderCarregando() {
  const msg = document.getElementById("msg-carregando");
  if (msg) msg.remove();
}

async function enviarAtividadeParaGemini(textoAtividade, arquivo) {
  if (arquivo) adicionarMensagemUsuario(`Arquivo enviado: ${arquivo.name}`);
  mostrarCarregando();

  const formData = new FormData();
  formData.append("promptBase", TEIA_PROMPT_BASE);
  formData.append("parametros", JSON.stringify(parametrosAluno));
  formData.append("atividadeTexto", textoAtividade || "");
  if (arquivo) formData.append("arquivo", arquivo);

  try {
    const resposta = await fetch("/api/adaptar-atividade", {
      method: "POST",
      body: formData
    });

    if (!resposta.ok) throw new Error("Erro ao chamar a API da Gemini.");

    const dados = await resposta.json();
    esconderCarregando();

    sessionId = dados.sessionId || null;
    adicionarMensagemIA(dados.resposta || "A IA não retornou uma resposta válida.");

    if (sessionId) mostrarEscolhaPosAdaptacao(dados.resposta);
  } catch (erro) {
    esconderCarregando();
    console.error(erro);
    adicionarMensagemIA("Não consegui gerar a adaptação agora. Verifique se o servidor está rodando, se a chave da Gemini foi configurada e se o arquivo está em formato aceito.");
  }
}

async function enviarMensagemContinuacao(mensagem) {
  mostrarCarregando();

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
    esconderCarregando();

    const textoResposta = dados.resposta || "A IA não retornou uma resposta válida.";
    adicionarMensagemIA(textoResposta);
    mostrarEscolhaPosAdaptacao(textoResposta);
  } catch (erro) {
    esconderCarregando();
    console.error(erro);
    adicionarMensagemIA("Não consegui processar sua solicitação. " + erro.message);
  }
}

function mostrarEscolhaPosAdaptacao(textoAdaptacao) {
  const mensagens = document.getElementById("mensagens");

  mensagens.innerHTML += `
    <div class="mensagem mensagem-ia escolha-pos-adaptacao">
      <strong>TEIA:</strong><br>
      O que deseja fazer agora?<br><br>
      <div class="botoes-escolha">
        <button class="botao-escolha botao-escolha-pdf" onclick="baixarArquivo(this, 'pdf')">
          ⬇ Baixar PDF
        </button>
        <button class="botao-escolha botao-escolha-docx" onclick="baixarArquivo(this, 'docx')">
          ⬇ Baixar DOCX
        </button>
        <button class="botao-escolha" onclick="mesmoPerfilNovaAtividade()">
          Mesma perfil, nova atividade
        </button>
        <button class="botao-escolha botao-escolha-secundario" onclick="novoPerfilNovaAtividade()">
          Novo perfil e nova atividade
        </button>
      </div>
    </div>
  `;

  const botoes = mensagens.querySelectorAll(".escolha-pos-adaptacao .botao-escolha-pdf, .escolha-pos-adaptacao .botao-escolha-docx");
  botoes.forEach(b => b._textoAdaptacao = textoAdaptacao);

  rolarChatParaBaixo();
}

async function baixarArquivo(botao, tipo) {
  const texto = botao._textoAdaptacao;
  if (!texto) return;

  const labelOriginal = botao.textContent;
  botao.textContent = "Gerando...";
  botao.disabled = true;

  try {
    const resposta = await fetch(`/api/gerar-${tipo}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texto })
    });

    if (!resposta.ok) throw new Error(`Erro ao gerar ${tipo.toUpperCase()}.`);

    const blob = await resposta.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `atividade-adaptada.${tipo}`;
    link.click();
    URL.revokeObjectURL(url);

    botao.textContent = `✓ ${tipo.toUpperCase()} baixado`;
  } catch (erro) {
    console.error(erro);
    botao.textContent = labelOriginal;
    botao.disabled = false;
  }
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

  const div = document.createElement("div");
  div.className = "mensagem mensagem-usuario";

  div.innerHTML = `
    <strong>Você</strong><br>
    ${escaparHTML(texto).replace(/\n/g, "<br>")}
  `;

  mensagens.appendChild(div);

  rolarChatParaBaixo();
}

function adicionarMensagemIA(texto) {
  const mensagens = document.getElementById("mensagens");

  const div = document.createElement("div");
  div.className = "mensagem mensagem-ia";

  div.innerHTML = `
    <strong>TEIA</strong><br>
    ${formatarRespostaIA(texto)}
  `;

  mensagens.appendChild(div);

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