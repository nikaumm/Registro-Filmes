// 1. Configuração do projeto
const URL_SUPABASE = "https://omdjovzztlopcwemmklf.supabase.co";
const CHAVE_PUBLICAVEL = "sb_publishable_dj9sF1vqTv9RP6LQq5m_ow_LSNhzDiS";
const banco = supabase.createClient(URL_SUPABASE, CHAVE_PUBLICAVEL);

// 2. Atalhos para elementos da página
const elemento = (id) => document.getElementById(id);

function avisar(mensagem) {
  elemento("aviso").textContent = mensagem;
}

function numeroOuNulo(valor) {
  return valor === "" ? null : Number(valor);
}

function textoOuNulo(valor) {
  const limpo = valor.trim();
  return limpo === "" ? null : limpo;
}

// 3. Alternar entre login e aplicativo
function mostrarTelas(logado) {
  elemento("tela-login").hidden = logado;
  elemento("tela-app").hidden = !logado;
}

// 4. Ler dados do banco
async function carregarUltimos() {
  const { data, error } = await banco
    .from("filmes")
    .select("titulo, nota, data_assistido")
    .not("titulo", "is", null)
    .order("registrado_em", { ascending: false })
    .order("data_assistido", { ascending: false, nullsFirst: false })
    .limit(5);

  if (error) {
    avisar("Não consegui ler os filmes: " + error.message);
    return;
  }

  const lista = elemento("ultimos");
  lista.replaceChildren();

  for (const filme of data) {
    const item = document.createElement("li");
    const dataTexto = filme.data_assistido ?? "sem data";
    item.textContent = `${filme.titulo}: nota ${filme.nota} (${dataTexto})`;
    lista.appendChild(item);
  }
}

async function preencherSugestoes(coluna, idLista) {
  const { data, error } = await banco.from(coluna === "genero" ? "kpi_genero" : "kpi_plataforma").select(coluna);
  if (error) return;

  const lista = elemento(idLista);
  lista.replaceChildren();

  for (const linha of data) {
    const opcao = document.createElement("option");
    opcao.value = linha[coluna];
    lista.appendChild(opcao);
  }
}

async function carregarTudo() {
  await Promise.all([
    carregarUltimos(),
    preencherSugestoes("genero", "generos"),
    preencherSugestoes("plataforma", "plataformas"),
  ]);
}

// Mostrar ou ocultar a senha
function definirSenhaVisivel(visivel) {
  elemento("senha").type = visivel ? "text" : "password";
  elemento("ver-senha").textContent = visivel ? "Ocultar" : "Mostrar";
  elemento("ver-senha").setAttribute("aria-pressed", String(visivel));
}

elemento("ver-senha").addEventListener("click", () => {
  const estaOculta = elemento("senha").type === "password";
  definirSenhaVisivel(estaOculta);
});

// 5. Login e saída
elemento("form-login").addEventListener("submit", async (evento) => {
  evento.preventDefault(); definirSenhaVisivel(false);
  avisar("Entrando...");

  const { error } = await banco.auth.signInWithPassword({
    email: elemento("email").value,
    password: elemento("senha").value,
  });

  if (error) {
    avisar("Erro: " + error.message);
    //avisar("Não foi possível entrar. Confira e-mail e senha.");
    return;
  }

  avisar("");
  mostrarTelas(true);
  await carregarTudo();
});

elemento("sair").addEventListener("click", async () => {
  await banco.auth.signOut();
  mostrarTelas(false);
});

// 6. Salvar um filme
elemento("form-filme").addEventListener("submit", async (evento) => {
  evento.preventDefault();

  const data = elemento("data").value;
  const novoFilme = {
    ano_assistido: Number(data.slice(0, 4)),
    titulo: textoOuNulo(elemento("titulo").value),
    nota: Number(elemento("nota").value),
    data_assistido: data,
    genero: textoOuNulo(elemento("genero").value),
    minutos: numeroOuNulo(elemento("minutos").value),
    ano_lancamento: numeroOuNulo(elemento("lancamento").value),
    plataforma: textoOuNulo(elemento("plataforma").value),
  };

  const { error } = await banco.from("filmes").insert(novoFilme);

  if (error) {
    avisar("Não foi possível salvar: " + error.message);
    return;
  }

  avisar(`${novoFilme.titulo} foi salvo.`);
  evento.target.reset();
  elemento("data").value = hoje();
  await carregarUltimos();
});

// 7. Salvar uma série
elemento("form-serie").addEventListener("submit", async (evento) => {
  evento.preventDefault();

  const inicio = elemento("serie-inicio").value;
  const fim = elemento("serie-fim").value;
  const novaSerie = {
    ano_referencia: Number((fim || inicio).slice(0, 4)),
    titulo: textoOuNulo(elemento("serie-titulo").value),
    nota: numeroOuNulo(elemento("serie-nota").value),
    inicio,
    fim: fim === "" ? null : fim,
    genero: textoOuNulo(elemento("serie-genero").value),
    plataforma: textoOuNulo(elemento("serie-plataforma").value),
  };

  const { error } = await banco.from("series").insert(novaSerie);

  if (error) {
    avisar("Não foi possível salvar: " + error.message);
    return;
  }

  avisar(`${novaSerie.titulo} foi salva.`);
  evento.target.reset();
  elemento("serie-inicio").value = hoje();
});

function hoje() {
  const agora = new Date();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");
  return `${agora.getFullYear()}-${mes}-${dia}`;
}

// 8. Início: verifica se já existe uma sessão aberta
async function iniciar() {
  elemento("data").value = hoje();
  elemento("serie-inicio").value = hoje();
  const { data } = await banco.auth.getSession();
  const logado = Boolean(data.session);
  mostrarTelas(logado);
  if (logado) await carregarTudo();
}

iniciar();