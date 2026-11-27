# Auditoria da interface (#65)

A issue não tinha descrição, então eu considerei: olhar o app inteiro atrás de problema de acessibilidade e usabilidade e corrigir o que dava sem invadir as outras issues de interface (#63 menu/header, #64 filtros, #35 e #56 Teste Folha).

## Como testei

- Criei um script, `npm run audit:interface`, que lê o código das telas e lista os problemas (botão sem label, alvo de toque pequeno, texto pequeno, Modal sem `onRequestClose`, essas coisas). As regras estão no começo do arquivo `scripts/auditoria-interface.mjs`. Os testes dele rodam com `npm run test:auditoria`.
- Pra Login e Dashboard também montei uma simulação no navegador (Chromium, com o Firebase falso) em tela de 390px e 320px, com fonte normal e com 150%. Medi tamanho dos botões, se tinha texto vazando, sobreposição e o fluxo (enter nos campos, mostrar senha, checkbox, ajuda, erro de login). Essa simulação não está no repositório.

## Resultado

Ocorrências por tela (graves / médias / baixas):

| Tela | Antes | Depois |
| --- | --- | --- |
| Login | 10 / 13 / 3 | 0 / 3 / 0 |
| Dashboard | 0 / 3 / 0 | 0 / 0 / 0 |
| Home | 0 / 1 / 3 | não mexi (#63) |
| Usuários | 0 / 0 / 1 | não mexi (#64) |
| Talhões | 0 / 3 / 0 | não mexi (#64) |
| Histórico | 0 / 5 / 0 | não mexi (#64) |
| Detalhe da análise | 0 / 2 / 0 | não mexi |
| Imagem da análise | 0 / 2 / 0 | não mexi |
| Teste Folha | 7 / 18 / 3 | não mexi (#35, #56) |

Na simulação do Login com tela de 320px:

- botões com menos de 48px: 6 de 7 antes, 0 de 7 depois
- controles sem nome pro leitor de tela: 2 antes, 0 depois
- textos vazando da tela ou do botão com fonte a 150%: 2 antes, 0 depois

Com a fonte normal nada vazava, nem antes.

## O que mudou

Login:

- o primeiro toque no "Acessar" com o teclado aberto só fechava o teclado, agora funciona (`keyboardShouldPersistTaps`)
- `KeyboardAvoidingView` na tela e no modal, enter na matrícula vai pra senha e enter na senha faz o login
- o botão voltar do android fecha o modal de recuperação
- label e role nos inputs e nos botões só com ícone, erro de login vira `alert`
- o botão "?" não fazia nada e agora abre uma explicação de como conseguir acesso
- alvos de 48px e o input ocupando o campo todo (antes só uns 24px dos 64px respondiam ao toque)
- fontes de 10 a 13px subiram, rodapé e placeholder ficaram mais escuros pro contraste
- com fonte grande o banner cresce e os textos quebram linha em vez de serem cortados
- a versão do rodapé vem do `app.json` (1.0.0) e não do "v0.0.1" fixo

Dashboard: legenda e nota em 14px, cinza do gráfico mais escuro e a busca do filtro dentro de `KeyboardAvoidingView`.

## Pra decidir

1. O checkbox "Lembrar neste aparelho (Modo Campo Offline)" não faz nada. O estado muda mas ninguém lê, e o Firebase sempre guarda a sessão. Remover ou implementar?
2. O texto do alert do botão "?" é novo e precisa de revisão.
3. Se o "v0.0.1" do rodapé era de propósito, é só voltar aquela linha.
4. As cores do Login (`#00450D`, `#FAFAF5`, `#BA1A1A`) são diferentes do resto do app (`#1B5E20`, `#F7F8F4`, `#A01818`). Não mexi.
5. Usei 14px como mínimo pra texto de conteúdo e deixei 12 a 13px nos textos decorativos do Login. Se quiserem 14px em tudo, ainda sobram 3 no Login.

## Ficou pras outras issues

- Home (#63): botão do header com 42px, alturas fixas de 68 e 40.
- Histórico, Usuários e Talhões (#64): textos de 12 a 13px, Histórico sem `KeyboardAvoidingView` nos filtros, altura fixa de 40 em Usuários.
- Teste Folha (#35, #56): 7 textos de 11px, 2 botões de 44px, 5 contrastes pra revisar, 3 alturas fixas e sem `KeyboardAvoidingView`.
- Detalhe da análise e imagem com marcações: textos de 12 a 13px.

## O que não testei

- Nada rodou em celular nem em emulador. A simulação é flexbox de navegador, que é parecido com o do React Native mas não igual. O que mais merece olhada no celular são as margens negativas e o `columnGap` do Login.
- Teclado no iOS e botão voltar do android eu só conferi lendo o código.
- Não usei TalkBack nem VoiceOver, só conferi se os nomes e roles estão no código.
- O contraste é estimado pelas cores declaradas, texto claro sobre imagem não é avaliado.
- Usuários, Talhões, Histórico e Detalhe não foram renderizados na simulação.

## Pra conferir no celular

1. Login com a fonte do sistema no máximo, em celular pequeno: nada cortado e botão legível.
2. Tocar na borda de cima e de baixo do campo de matrícula: o teclado tem que abrir.
3. Com o teclado aberto, um toque no "Acessar" já basta.
4. Matrícula, enter, senha, enter: entra sem tocar no botão.
5. "Esqueceu a senha?" e depois o botão voltar do android: fecha o modal.
6. Com TalkBack ou VoiceOver: cada botão é lido com nome e como botão, e o erro de login é lido sozinho.

## Rodar de novo

`npm run audit:interface -- --detalhes` mostra cada ocorrência. Com `--falhar` ele sai com erro se achar algo grave, dá pra usar em CI quando as telas pendentes forem corrigidas.
