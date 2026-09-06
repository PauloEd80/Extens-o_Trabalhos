# Instruções de Configuração — Portal de Extensão (v3)

Este arquivo é o passo a passo operacional: o que fazer, clique a clique,
para colocar o sistema no ar. Para entender o raciocínio por trás do
projeto, veja o `README.md`.

A URL da sua implantação já está preenchida dentro do `index.html`
(`https://script.google.com/macros/s/AKfycbx_.../exec`), então você **não
precisa editar esse arquivo** — a menos que reimplante o Apps Script do zero
no futuro e receba uma URL nova.

---

## Passo 1 — Atualizar o backend na planilha existente

1. Abra a planilha que você já vinha usando como banco de dados.
2. Menu **Extensões → Apps Script**.
3. Apague todo o conteúdo do arquivo `Code.gs` atual e cole o conteúdo do
   `Code.gs` deste pacote.
4. Salve (Ctrl+S).

Isso não apaga nenhum dado da planilha — o script só define como ler e
escrever nela.

## Passo 2 — Rodar a configuração inicial

1. No seletor de funções (topo do editor), escolha **configurarPlanilhaInicial**.
2. Clique em **Executar** e autorize as permissões solicitadas.
3. Essa função é segura para rodar de novo em uma planilha que já tem dados:
   ela só cria o que ainda não existe. Na prática, isso significa que ela vai
   adicionar uma nova linha `ADMIN_PASSWORD` na aba `Config` (valor inicial:
   `admin123`), sem tocar nas submissões que você já tinha.
4. Se a planilha ainda tiver uma aba `Admins` de uma versão anterior do
   sistema (baseada em e-mails do Google), ela pode ser mantida ou apagada —
   este sistema não a utiliza mais.

## Passo 3 — Reimplantar a Web App

Como o código mudou, é preciso publicar uma nova versão *na mesma URL* já
existente (não criar uma implantação nova, senão a URL muda):

1. **Implantar → Gerenciar implantações**.
2. Clique no ícone de lápis (✏️) da implantação ativa.
3. Em "Versão", escolha **Nova versão**.
4. Confirme que **Quem pode acessar** está como **Qualquer pessoa** — é assim
   que o site (hospedado fora do Google) consegue chamar a API.
5. Clique em **Implantar**.

Se pedir autorização de permissões novamente, aceite.

## Passo 4 — Publicar o site

O arquivo `index.html` é autossuficiente — não depende de nenhum outro
arquivo, nem imagem externa. Basta subir ele em qualquer um destes lugares:

- **GitHub Pages**: crie um repositório, suba o `index.html` na raiz, ative
  o Pages em Settings → Pages.
- **Vercel / Netlify**: arraste a pasta com o `index.html` no painel de
  deploy (não precisa de Git).
- **Teste local rápido**: abra o `index.html` direto no navegador. Alguns
  navegadores bloqueiam `fetch()` em arquivos abertos assim; se isso
  acontecer, rode `python3 -m http.server` na pasta e acesse
  `http://localhost:8000`.

## Passo 5 — Conferir a configuração pela tela do site

1. Acesse o site publicado.
2. Toque em **Área Administrativa**, digite a senha `admin123`.
3. Vá em **Configurações** e confira se os três campos (pasta do Drive,
   template do relatório, template do banner) já mostram os IDs que você
   configurou antes na planilha. Se estiverem em branco, preencha ali mesmo
   e clique em **Salvar configurações**.

## Passo 6 — Trocar a senha padrão

Ainda em **Configurações**, na seção "Trocar senha de administrador",
troque `admin123` por uma senha só sua antes de divulgar o link.

## Passo 7 — Testar pelo celular

1. Abra o link do site no celular.
2. Preencha o formulário — ele é dividido em 5 etapas curtas, com uma barra
   de progresso no topo. Anexe uma foto de teste (o botão de upload já abre
   a câmera ou a galeria, dependendo do celular).
3. Envie e confirme a tela de sucesso.
4. Entre na Área Administrativa e confira se a submissão de teste aparece
   na lista, com os botões de gerar Relatório, Banner e Gerar Tudo
   funcionando.

---

## Se precisar trocar as imagens da marca no futuro

As três imagens (logotipo da faculdade e as duas variações do Ecohub) estão
embutidas dentro do próprio `index.html`, como texto codificado em Base64 —
não são arquivos separados. Para trocar uma delas:

1. Gere o código Base64 da nova imagem (qualquer conversor "imagem para
   Base64" online, ou o comando abaixo caso tenha Python instalado):
   ```
   python3 -c "import base64; print(base64.b64encode(open('nova-logo.png','rb').read()).decode())"
   ```
2. No `index.html`, procure por uma destas três linhas (perto do final do
   arquivo, dentro do bloco `<script>`):
   ```js
   document.getElementById('img-logo-header').src = 'data:image/png;base64,...';
   document.getElementById('img-ecohub-centro').src = 'data:image/png;base64,...';
   document.getElementById('img-ecohub-maker').src = 'data:image/png;base64,...';
   ```
3. Substitua todo o texto depois de `base64,` (até o `'` de fechamento) pelo
   novo código gerado.
4. Salve e publique de novo.

## Erros comuns

- **"Falha de conexão com a API"** → confira se a implantação do Apps
  Script ainda está ativa (Implantar → Gerenciar implantações).
- **"Senha de administrador inválida"** → confira a aba `Config` na
  planilha, linha `ADMIN_PASSWORD`.
- **"Configuração ausente na aba Config"**, ao gerar relatório/banner →
  falta preencher `ROOT_FOLDER_ID`, `DOC_TEMPLATE_ID` ou `SLIDE_TEMPLATE_ID`,
  pela tela de Configurações do site ou direto na planilha.
