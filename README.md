# 🎬 Registro de Filmes

Registro pessoal de filmes e séries: registro o que assisto, com nota, data e plataforma,
e os dados de ano, duração e gêneros vêm automaticamente da API do TMDB.

🔗 **Site:** https://nikaumm.github.io/Registro-Filmes/ (acesso restrito ao dono)

![Tela do site](captura.png)

## Por que fiz

Eu registrava tudo numa planilha do Google Sheets, com médias calculadas à mão e erros
(uma média de 2026 aparecia como 4,10 em vez de 7,18). Migrei para um banco PostgreSQL
para aprender SQL, APIs e desenvolvimento web na prática.

## Funcionalidades

- Login com e-mail e senha (cadastro público desativado)
- Registro de filmes e séries com busca automática no TMDB enquanto digito
- Séries "em andamento", que concluo depois, com nota e data de fim
- Painel com indicadores e gráficos (Chart.js)
- Listas de últimos filmes e séries
- Modo claro/escuro e layout responsivo
- Aviso quando o banco está pausado (o plano gratuito do Supabase pausa após 7 dias sem uso)

## Tecnologias

HTML, CSS, JavaScript · Supabase (PostgreSQL, Auth, Edge Functions em Deno) ·
API do TMDB · Chart.js · GitHub Pages · Python/pandas (migração dos dados da planilha)

## Arquitetura

```
Navegador (GitHub Pages) ──► Supabase Auth + PostgreSQL (com RLS)
                         └─► Edge Function "tmdb" ──► API do TMDB
```

## Segurança

- **Row Level Security:** cada linha só pode ser lida ou alterada pelo próprio dono (`auth.uid()`).
- A chave `sb_publishable` no `app.js` é pública por natureza. Sem login, ela não dá acesso a dados.
- O token do TMDB fica guardado como secret na Edge Function e nunca vai para o navegador.
- Arquivos com dados pessoais (CSV) e scripts locais estão no `.gitignore`.

## Banco de dados

Tabelas `filmes` e `series`, com views de KPI (`kpi_geral`, `kpi_ano`, `kpi_mes`,
`kpi_genero`, `kpi_plataforma`).

## Como rodar sua própria cópia

1. Crie um projeto no [Supabase](https://supabase.com) e as tabelas `filmes` e `series` com RLS.
2. Publique a Edge Function `tmdb` e salve seu token do TMDB como secret `TMDB_TOKEN`.
3. No `app.js`, troque `URL_SUPABASE` e `CHAVE_PUBLICAVEL` pelos dados do seu projeto.
4. Publique a pasta no GitHub Pages (ou abra o `index.html` com um servidor local).

## O que aprendi

- Modelar tabelas e escrever consultas SQL
- Proteger dados com RLS em vez de esconder chaves
- Consumir uma API externa sem expor o token
- Tratar erros de conexão com mensagens claras para o usuário
- Usar git e publicar no GitHub Pages

## Próximos passos

- [ ] Conectar o Power BI ao banco

## Créditos

This product uses the TMDB API but is not endorsed or certified by TMDB.
