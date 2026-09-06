# Portal de Extensão Universitária — Guia do Projeto

Este texto é para quem for dar continuidade ao projeto e precisa entender,
rapidamente, como ele foi pensado e como as peças se encaixam. Não é um manual
de referência exaustivo — é a explicação que eu daria em uma aula, antes de
entregar o código para alguém mexer nele.

## A ideia geral

O sistema tem duas metades independentes, que conversam por internet, mas
que podem ser trocadas ou hospedadas separadamente sem que uma dependa de
onde a outra está fisicamente:

1. **O banco de dados e o "motor" de geração de arquivos** vivem inteiramente
   dentro do Google (uma planilha + um script). É o Google quem guarda os
   dados das submissões, quem cria pastas no Drive e quem transforma os
   templates de Word e PowerPoint em arquivos finais.
2. **A cara do site** — o formulário que o aluno preenche e o painel que o
   professor usa — é um único arquivo HTML, sem depender do Google para
   existir. Pode morar no GitHub Pages, na Vercel, ou em qualquer servidor
   de arquivos estáticos.

A ponte entre as duas metades é uma URL. O site "conversa" com o Google
Apps Script da mesma forma que qualquer site conversa com uma API: manda um
pedido, recebe uma resposta em JSON.

Essa separação existe por um motivo prático: manter a "cara" do site fora do
Google dá liberdade para hospedar, versionar e editar o visual sem depender
das limitações de interface do Apps Script — e sem misturar a lógica de
negócio (planilha, Drive, geração de documentos) com a lógica de apresentação.

## Por que uma senha, e não login do Google?

Na primeira versão do projeto, o sistema reconhecia administradores pelo
e-mail da conta Google logada. Isso deixou de funcionar quando o site saiu
de dentro do Google — um site externo não tem acesso à sessão do Google do
visitante. A solução mais simples foi trocar por uma senha única de
administrador, guardada na própria planilha. Não é o método mais seguro que
existe, mas é suficiente para o que o projeto precisa: impedir que qualquer
visitante casual abra o painel administrativo. Quem tiver a senha, entra.

## Os arquivos e o que cada um faz

**`Code.gs`** é o script que roda dentro do Google, vinculado à planilha.
Ele faz três coisas: guarda as submissões na aba `Submissoes`, guarda as
configurações (senha e IDs de arquivos do Drive) na aba `Config`, e sabe
transformar os dados de uma submissão em um relatório Word/PDF e um banner
PowerPoint, a partir de dois templates que você mesmo cria no Google Docs
e no Google Slides.

**`index.html`** é o site inteiro — HTML, estilo visual e toda a lógica de
interface, em um único arquivo. Ele foi desenhado primeiro para celular: o
formulário de submissão é dividido em cinco etapas curtas, uma por vez, para
que ninguém precise rolar uma tela infinita procurando o próximo campo. As
imagens da marca (o logotipo da Faculdade Positivo e as duas variações do
Ecohub) estão embutidas dentro do próprio arquivo, então não existem
"arquivos de imagem soltos" para se perder — mexer no HTML é mexer em tudo.

## O que fica em cada lugar

| O que é | Onde mora | Quem administra |
|---|---|---|
| Dados de cada submissão | Aba `Submissoes` da planilha | Google Sheets |
| Senha do admin e IDs dos templates | Aba `Config` da planilha | Google Sheets, ou pela tela de Configurações do site |
| Fotos e vídeos enviados | Pastas no Google Drive (uma por submissão) | Google Drive |
| Templates de relatório e banner | Um Google Doc e um Google Slides à parte | Você edita quando quiser mudar o layout dos arquivos gerados |
| A aparência e o comportamento do site | `index.html` | Onde você hospedar (GitHub Pages, Vercel, etc.) |

## O caminho de uma submissão, do início ao fim

Um aluno abre o site pelo celular, preenche as cinco etapas, anexa fotos
tiradas na hora, e envia. Nesse momento, o `index.html` empacota tudo — texto
e fotos convertidas em código Base64 — e manda para a URL do Apps Script.
O `Code.gs` recebe esse pacote, cria uma pasta nova dentro da pasta raiz do
Drive, salva as fotos ali, e grava uma linha nova na aba `Submissoes`.

Mais tarde, o professor entra na área administrativa (com a senha), vê a
lista de submissões, e pode pedir para gerar o relatório e o banner de um
projeto específico. Nesse momento o `Code.gs` copia os templates do Docs e
do Slides, substitui os marcadores `{{TITULO}}`, `{{AUTORES}}` etc. pelos
dados daquela submissão, insere as fotos, e produz os arquivos finais
(PDF, DOCX, PPTX), salvando os links de volta na planilha.

## Onde um professor futuro provavelmente vai precisar mexer

- **Trocar a senha padrão** (`admin123`) — pela própria tela de
  Configurações do site, assim que o sistema entrar em uso.
- **Editar os templates do Google Docs e do Google Slides**, se o layout do
  relatório ou do banner precisar mudar. Os marcadores entre chaves duplas
  (`{{TITULO}}`, `{{RESUMO}}`, etc.) são o que conecta o template aos dados
  — não apagar nem renomear esses marcadores sem também atualizar o `Code.gs`.
- **Atualizar a URL da API** dentro do `index.html`, caso o projeto do Apps
  Script seja reimplantado do zero em algum momento (cada nova implantação
  gera uma URL diferente).
- **Trocar as imagens da marca**, se a identidade visual da instituição
  mudar — isso significa gerar um novo código Base64 da imagem e substituir
  o trecho correspondente dentro do `index.html` (veja o passo a passo no
  arquivo de instruções de configuração).

Este README não repete o passo a passo de instalação — isso está em um
arquivo separado, mais operacional, pensado para ser seguido clique a
clique. Este texto aqui é só para entender o raciocínio por trás das
escolhas, antes de abrir o código.
