// 1. Configuração do projeto
const URL_SUPABASE = "https://omdjovzztlopcwemmklf.supabase.co";
const CHAVE_PUBLICAVEL = "sb_publishable_dj9sF1vqTv9RP6LQq5m_ow_LSNhzDiS";
const banco = supabase.createClient(URL_SUPABASE, CHAVE_PUBLICAVEL);

// 2. Atalhos para elementos da página
const elemento = (id) => document.getElementById(id);

function avisar(mensagem) {
  elemento("aviso").textContent = mensagem;
}

// 2b. Aviso de banco pausado
// O Supabase gratuito pausa o projeto depois de 7 dias sem uso.
// Pausado, o servidor não responde e toda chamada falha antes de chegar ao banco.
function ehFalhaDeConexao(error) {
  if (!error) return false;
  if (error.name === "AuthRetryableFetchError" || error.name === "FunctionsFetchError") return true;
  return /failed to fetch|networkerror|load failed|fetch failed/i.test(error.message ?? "");
}

function mostrarPausado() {
  elemento("aviso-pausado-texto").textContent = navigator.onLine
    ? "O banco de dados não respondeu. Provavelmente o projeto do Supabase está pausado " +
      "(projetos gratuitos pausam depois de 7 dias sem uso). Abra o painel, clique em " +
      "\"Restore project\", espere alguns minutos e tente de novo."
    : "Você está sem internet. Confira a conexão e tente de novo.";
  elemento("aviso-pausado").hidden = false;
  avisar("");
}

// Mostra o erro: se for falha de conexão, abre o aviso de banco pausado.
// mostrarDetalhe = false esconde a mensagem técnica do erro.
function explicarErro(texto, error, mostrarDetalhe = true) {
  if (ehFalhaDeConexao(error)) {
    mostrarPausado();
    return;
  }
  avisar(mostrarDetalhe && error?.message ? `${texto}: ${error.message}` : `${texto}.`);
}

// Pergunta ao servidor se ele está no ar, sem precisar de login.
async function verificarServidor() {
  try {
    const resposta = await fetch(`${URL_SUPABASE}/auth/v1/health`, {
      headers: { apikey: CHAVE_PUBLICAVEL },
    });
    if (resposta.status >= 500) mostrarPausado();
  } catch {
    mostrarPausado();
  }
}

const idProjeto = new URL(URL_SUPABASE).hostname.split(".")[0];
elemento("link-supabase").href = `https://supabase.com/dashboard/project/${idProjeto}`;
elemento("tentar-de-novo").addEventListener("click", () => location.reload());

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
    explicarErro("Não consegui ler os filmes", error);
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

function periodoSerie(serie) {
  if (serie.inicio && serie.fim) return `${serie.inicio} a ${serie.fim}`;
  if (serie.inicio) return `desde ${serie.inicio}`;
  if (serie.fim) return `terminou em ${serie.fim}`;
  return "sem data";
}

async function carregarUltimasSeries() {
  const { data, error } = await banco
    .from("series")
    .select("titulo, nota, inicio, fim, status")
    .not("titulo", "is", null)
    .order("id", { ascending: false })
    .limit(5);

  if (error) {
    explicarErro("Não consegui ler as séries", error);
    return;
  }

  const lista = elemento("ultimas-series");
  lista.replaceChildren();

  for (const serie of data) {
    const item = document.createElement("li");
    const situacao = serie.status === "Em andamento" ? "em andamento" : `nota ${serie.nota}`;
    item.textContent = `${serie.titulo}: ${situacao} (${periodoSerie(serie)})`;
    lista.appendChild(item);
  }
}

// Séries em andamento
async function carregarSeriesEmAndamento() {
  const { data, error } = await banco
    .from("series")
    .select("id, titulo, inicio")
    .eq("status", "Em andamento")
    .not("titulo", "is", null)
    .order("inicio", { ascending: false });

  if (error) {
    explicarErro("Não consegui ler as séries em andamento", error);
    return;
  }

  const lista = elemento("series-andamento");
  lista.replaceChildren();

  if (data.length === 0) {
    const item = document.createElement("li");
    item.textContent = "Nenhuma série em andamento.";
    lista.appendChild(item);
    return;
  }

  for (const serie of data) {
    lista.appendChild(criarItemAndamento(serie));
  }
}

function criarItemAndamento(serie) {
  const item = document.createElement("li");
  item.className = "andamento";

  const nome = document.createElement("span");
  nome.textContent = `${serie.titulo} (desde ${serie.inicio ?? "data desconhecida"})`;

  const nota = document.createElement("input");
  nota.type = "number";
  nota.min = "0";
  nota.max = "10";
  nota.step = "0.05";
  nota.placeholder = "Nota";
  nota.setAttribute("aria-label", `Nota de ${serie.titulo}`);

  const fim = document.createElement("input");
  fim.type = "date";
  fim.value = hoje();
  fim.setAttribute("aria-label", `Fim de ${serie.titulo}`);

  const botao = criarBotao("Concluir", () => concluirSerie(serie, nota.value, fim.value));

  item.append(nome, nota, fim, botao);
  return item;
}

async function concluirSerie(serie, notaTexto, fim) {
  const nota = Number(notaTexto);

  if (notaTexto === "" || nota < 0 || nota > 10) {
    avisar("Informe uma nota de 0 a 10.");
    return;
  }
  if (!fim) {
    avisar("Informe a data de término.");
    return;
  }
  if (serie.inicio && fim < serie.inicio) {
    avisar("O fim precisa ser depois do início.");
    return;
  }

  const { error } = await banco
    .from("series")
    .update({ nota, fim, ano_referencia: Number(fim.slice(0, 4)) })
    .eq("id", serie.id);

  if (error) {
    explicarErro("Não foi possível concluir", error);
    return;
  }

  avisar(`${serie.titulo} foi concluída.`);
  await Promise.all([carregarSeriesEmAndamento(), carregarUltimasSeries()]);
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
    carregarUltimasSeries(),
    carregarSeriesEmAndamento(),
    carregarPainel(),
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
  evento.preventDefault();
  definirSenhaVisivel(false);
  avisar("Entrando...");

  const { error } = await banco.auth.signInWithPassword({
    email: elemento("email").value,
    password: elemento("senha").value,
  });

  if (error) {
    if (ehFalhaDeConexao(error)) mostrarPausado();
    else avisar("Não foi possível entrar. Confira e-mail e senha.");
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

  const { error } = await banco.from("filmes").insert({ ...novoFilme, ...dadosTmdb });

  if (error) {
    explicarErro("Não foi possível salvar", error);
    return;
  }

  avisar(`${novoFilme.titulo} foi salvo.`);
  evento.target.reset();
  elemento("data").value = hoje();
  limparTmdb();
  await carregarTudo();
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

  const { error } = await banco.from("series").insert({ ...novaSerie, ...dadosTmdbSerie });

  if (error) {
    explicarErro("Não foi possível salvar", error);
    return;
  }

  avisar(`${novaSerie.titulo} foi salva.`);
  evento.target.reset();
  elemento("serie-inicio").value = hoje();
  limparTmdbSerie();
  await Promise.all([carregarUltimasSeries(), carregarSeriesEmAndamento()]);
});

// 9. Busca no TMDB
let dadosTmdb = {};

function limparTmdb() {
  dadosTmdb = {};
  elemento("candidatos").replaceChildren();
  elemento("generos-tmdb").replaceChildren();
}

function criarBotao(texto, aoClicar) {
  const botao = document.createElement("button");
  botao.type = "button";
  botao.className = "secundario";
  botao.textContent = texto;
  botao.addEventListener("click", aoClicar);
  return botao;
}

let esperaFilme;
let ultimaBuscaFilme = 0;

async function buscarNoTmdb() {
  const titulo = elemento("titulo").value.trim();
  const minhaBusca = ++ultimaBuscaFilme;

  if (titulo.length < 3) {
    limparTmdb();
    return;
  }

  avisar("Buscando...");
  const { data, error } = await banco.functions.invoke("tmdb", { body: { titulo } });

  if (minhaBusca !== ultimaBuscaFilme) return;

  if (error) {
    explicarErro("A busca no TMDB falhou. Preencha os campos manualmente", error, false);
    return;
  }

  avisar(data.candidatos.length ? "Escolha o filme certo:" : "Nenhum filme encontrado.");
  limparTmdb();

  for (const candidato of data.candidatos) {
    const texto = `${candidato.titulo} (${candidato.ano_lancamento ?? "sem ano"})`;
    elemento("candidatos").appendChild(criarBotao(texto, () => escolherFilme(candidato.id)));
  }
}

async function escolherFilme(id) {
  clearTimeout(esperaFilme);
  ultimaBuscaFilme++;
  const { data, error } = await banco.functions.invoke("tmdb", { body: { id } });

  if (error) {
    explicarErro("Não consegui trazer os detalhes do filme", error, false);
    return;
  }

  limparTmdb();
  dadosTmdb = { tmdb_id: data.tmdb_id, tmdb_generos: data.generos, nota_tmdb: data.nota_tmdb };

  elemento("titulo").value = data.titulo;
  elemento("minutos").value = data.minutos ?? "";
  elemento("lancamento").value = data.ano_lancamento ?? "";

  for (const genero of data.generos) {
    elemento("generos-tmdb").appendChild(
      criarBotao(genero, () => { elemento("genero").value = genero; })
    );
  }

  avisar("Dados preenchidos. Confira antes de salvar.");
}

function aoEditarTitulo() {
  if (dadosTmdb.tmdb_id) {
    elemento("genero").value = "";
    elemento("minutos").value = "";
    elemento("lancamento").value = "";
  }
  limparTmdb();
}

elemento("titulo").addEventListener("input", () => {
  aoEditarTitulo();
  clearTimeout(esperaFilme);
  esperaFilme = setTimeout(buscarNoTmdb, 500);
});

elemento("form-filme").addEventListener("reset", () => {
  limparTmdb();
  setTimeout(() => { elemento("data").value = hoje(); });
});

// Busca de séries no TMDB
let dadosTmdbSerie = {};

function separarTemporada(texto) {
  const partes = texto.match(/^(.*?)\s+S(\d+)$/i);
  return partes ? { nome: partes[1], temporada: partes[2] } : { nome: texto, temporada: null };
}

function limparTmdbSerie() {
  dadosTmdbSerie = {};
  elemento("candidatos-serie").replaceChildren();
  elemento("generos-tmdb-serie").replaceChildren();
}

let esperaSerie;
let ultimaBuscaSerie = 0;

async function buscarSerieNoTmdb() {
  const texto = elemento("serie-titulo").value.trim();
  const { nome, temporada } = separarTemporada(texto);
  const minhaBusca = ++ultimaBuscaSerie;

  if (nome.length < 3) {
    limparTmdbSerie();
    return;
  }

  avisar("Buscando...");
  const { data, error } = await banco.functions.invoke("tmdb", { body: { tipo: "serie", titulo: nome } });

  if (minhaBusca !== ultimaBuscaSerie) return;

  if (error) {
    explicarErro("A busca no TMDB falhou. Preencha os campos manualmente", error, false);
    return;
  }

  avisar(data.candidatos.length ? "Escolha a série certa:" : "Nenhuma série encontrada.");
  limparTmdbSerie();

  for (const candidato of data.candidatos) {
    const rotulo = `${candidato.titulo} (${candidato.ano_lancamento ?? "sem ano"})`;
    elemento("candidatos-serie").appendChild(criarBotao(rotulo, () => escolherSerie(candidato.id, temporada)));
  }
}

async function escolherSerie(id, temporada) {
  clearTimeout(esperaSerie);
  ultimaBuscaSerie++;
  const { data, error } = await banco.functions.invoke("tmdb", { body: { tipo: "serie", id } });

  if (error) {
    explicarErro("Não consegui trazer os detalhes da série", error, false);
    return;
  }

  limparTmdbSerie();
  dadosTmdbSerie = { tmdb_id: data.tmdb_id, tmdb_generos: data.generos, nota_tmdb: data.nota_tmdb };
  elemento("serie-titulo").value = temporada ? `${data.titulo} S${temporada}` : data.titulo;

  for (const genero of data.generos) {
    elemento("generos-tmdb-serie").appendChild(
      criarBotao(genero, () => { elemento("serie-genero").value = genero; })
    );
  }

  avisar(`Dados preenchidos (${data.temporadas ?? "?"} temporadas no TMDB). Confira antes de salvar.`);
}

function aoEditarTituloSerie() {
  if (dadosTmdbSerie.tmdb_id) elemento("serie-genero").value = "";
  limparTmdbSerie();
}

elemento("serie-titulo").addEventListener("input", () => {
  aoEditarTituloSerie();
  clearTimeout(esperaSerie);
  esperaSerie = setTimeout(buscarSerieNoTmdb, 500);
});

elemento("form-serie").addEventListener("reset", () => {
  limparTmdbSerie();
  setTimeout(() => { elemento("serie-inicio").value = hoje(); });
});

// 10. Painel
const graficos = {};

function criarCartao(rotulo, valor) {
  const cartao = document.createElement("div");
  cartao.className = "kpi";
  const numero = document.createElement("strong");
  numero.textContent = valor ?? "-";
  cartao.append(numero, rotulo);
  return cartao;
}

function desenharGrafico(id, tipo, rotulos, valores, titulo, opcoes = {}) {
  graficos[id]?.destroy();
  graficos[id] = new Chart(elemento(id), {
    type: tipo,
    data: {
      labels: rotulos,
      datasets: [{ label: titulo, data: valores, backgroundColor: "#8fb0e3" }],
    },
    options: {
      plugins: { title: { display: true, text: titulo }, legend: { display: false } },
      ...opcoes,
    },
  });
}

async function carregarPainel() {
  const [geral, anos, generos] = await Promise.all([
    banco.from("kpi_geral").select("*").single(),
    banco.from("kpi_ano").select("*").order("ano"),
    banco.from("kpi_genero").select("*").order("filmes", { ascending: false }).limit(8),
  ]);

  const erro = geral.error || anos.error || generos.error;
  if (erro) {
    explicarErro("Não consegui carregar o painel", erro, false);
    return;
  }

  const k = geral.data;
  elemento("kpis").replaceChildren(
    criarCartao("Filmes", k.filmes),
    criarCartao("Nota média", k.nota_media),
    criarCartao("Horas", k.horas),
    criarCartao("Favoritos", k.favoritos)
  );

  desenharGrafico("grafico-ano", "bar",
    anos.data.map((linha) => String(linha.ano)),
    anos.data.map((linha) => linha.filmes),
    "Filmes por ano");

  desenharGrafico("grafico-genero", "bar",
    generos.data.map((linha) => linha.genero),
    generos.data.map((linha) => linha.filmes),
    "Gêneros mais vistos",
    { indexAxis: "y" });
}

// 11. Tema claro e escuro
function aplicarTema(tema) {
  document.documentElement.dataset.tema = tema;
  elemento("trocar-tema").textContent = tema === "escuro" ? "Modo claro" : "Modo escuro";

  const estilo = getComputedStyle(document.documentElement);
  Chart.defaults.color = estilo.getPropertyValue("--cor-texto").trim();
  Chart.defaults.borderColor = estilo.getPropertyValue("--cor-linha").trim();
  if (Object.keys(graficos).length > 0) carregarPainel();
}

elemento("trocar-tema").addEventListener("click", () => {
  const novoTema = document.documentElement.dataset.tema === "escuro" ? "claro" : "escuro";
  localStorage.setItem("tema", novoTema);
  aplicarTema(novoTema);
});

function hoje() {
  const agora = new Date();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");
  return `${agora.getFullYear()}-${mes}-${dia}`;
}

// 8. Início: verifica se já existe uma sessão aberta
async function iniciar() {
  aplicarTema(document.documentElement.dataset.tema);
  elemento("data").value = hoje();
  elemento("serie-inicio").value = hoje();
  verificarServidor();
  const { data } = await banco.auth.getSession();
  const logado = Boolean(data.session);
  mostrarTelas(logado);
  if (logado) await carregarTudo();
}

iniciar();
