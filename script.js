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

let perguntasFluxo = [];
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

async function iniciarChatTeia() {
  adicionarMensagemIA(
    "Olá! Vou ajudar você a adaptar uma atividade para um estudante com TEA. Primeiro, me ajude a entender rapidamente o perfil do aluno para gerar uma adaptação adequada."
  );

  try {
    const resposta = await fetch("/api/perguntas");
    if (!resposta.ok) throw new Error("Falha ao carregar perguntas.");
    perguntasFluxo = await resposta.json();
  } catch (erro) {
    console.error(erro);
    adicionarMensagemIA("Não consegui carregar o fluxo de perguntas. Recarregue a página e tente novamente.");
    return;
  }

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
    alert("Digite uma mensagem ou envie um arquivo em pdf.");
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
    "Perfeito! Agora envie a atividade original que deseja adaptar. Você pode colar o texto no chat ou anexar um arquivo PDF."
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