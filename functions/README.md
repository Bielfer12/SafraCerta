# Gerenciamento de usuários do SafraCerta

**Produção em 21/10/2026:** Blaze ativado na conta de faturamento escolhida pelo usuário. `cadastrarUsuario`, `alterarUsuario` e `excluirUsuario` foram publicadas e confirmadas como ACTIVE em `safracerta-ee9ce`, região `southamerica-east1`, com Node.js 22. O aplicativo utiliza esses mesmos nomes e região.

A listagem consulta diretamente a coleção `usuarios` pelo SDK do Firestore. As regras autorizam somente quem tem perfil `usuarios/{uid}` com `tipoUsuario = ADMIN` e `statusConta = ATIVO`, sem operações pendentes. Essa leitura não depende de Cloud Functions nem de ativar o plano Blaze; utiliza a cota e a tarifação próprias do Firestore.

As funções `cadastrarUsuario`, `alterarUsuario` e `excluirUsuario` são chamadas pelo aplicativo na região `southamerica-east1`. Elas exigem identidade autenticada, conta Auth habilitada e o mesmo perfil administrativo ativo.

O aplicativo mantém a sessão de quem administra. Credenciais administrativas ficam no ambiente do servidor pelo Firebase Admin SDK; nenhuma chave privada deve ser colocada no aplicativo ou no repositório.

As funções usam a conta de serviço exclusiva `safracerta-usuarios@safracerta-ee9ce.iam.gserviceaccount.com`, com os papéis `roles/firebaseauth.admin` e `roles/datastore.user`. A configuração mantém zero instâncias mínimas e até cinco instâncias por função. Ao publicar em outro projeto, criar a identidade correspondente e ajustar `serviceAccount` em `index.js`. O cliente aguarda até 130 segundos para acompanhar o limite de 120 segundos do servidor.

## Dados e regras

- Cadastro: `nomeCompleto`, `matricula` (texto), `emailInstitucional` (também e-mail Auth), `telefone` opcional e `tipoUsuario` (`ADMIN` ou `FUNCIONARIO`). Novos perfis recebem `statusConta = ATIVO`.
- Vínculos: `usuarios/{uid}` usa o UID da conta Auth; `login_por_matricula/{matricula}` contém `email` e `uid`. O login legado que lê somente `email` continua compatível.
- Matrícula e e-mail de acesso são imutáveis neste módulo. A edição preserva status e campos legados. O titular continua podendo alterar nome e telefone diretamente conforme as regras.
- As escritas administrativas passam pelas funções. As regras bloqueiam essas escritas diretas do cliente, inclusive de ADMIN. Isso evita contornar a proteção do último administrador ou criar apenas uma parte do cadastro. A leitura administrativa é permitida diretamente pelas regras.
- A exclusão da própria conta é bloqueada. Exclusão e rebaixamento concorrem por um documento de controle transacional, impedindo remover a última permissão administrativa ativa.
- A exclusão definitiva remove somente conta Auth, perfil e índice por matrícula. Subcoleções vinculadas bloqueiam a exclusão. Atualmente não existe persistência de diagnósticos nos serviços do aplicativo; se outro módulo introduzir vínculos, sua política deve ser incluída antes de permitir excluir esses usuários.
- A tela lê a coleção ao abrir, atualizar ou concluir uma escrita. Ordena os nomes em português, com desempate por UID. A busca por nome ou matrícula acontece nos dados recebidos, ignora maiúsculas e acentos e preserva zeros. Digitar não dispara novas consultas. A lista usa FlatList; para grandes volumes, revisar o carregamento integral antes da expansão.
- A leitura preserva os valores originais dos campos administrados. Edição e exclusão comparam esses valores no servidor e recusam dados desatualizados. Campos legados fora desse conjunto são preservados. Não há migração de perfis.

## Falhas e retomada

`_operacoes_usuarios/{id}` guarda um recibo privado da criação e sua assinatura. O formulário conserva o ID durante tentativas. Uma transação reserva a matrícula e cria o perfil pendente antes de criar a conta Auth. O perfil pendente não concede acesso. A conta é criada sem senha e inicialmente desabilitada; a função finaliza os documentos, habilita a conta e só então confirma a conclusão. Se o processo for interrompido, a listagem mostra **Cadastro pendente** e oferece **Concluir cadastro** com os dados originais. E-mail já utilizado desfaz a reserva e o perfil pendente correspondente.

Na exclusão, o perfil recebe `exclusaoPendente` antes da remoção Auth. Isso retira acesso e reserva a matrícula até a limpeza dos documentos. Se houver falha, o administrador usa **Concluir exclusão**. Uma resposta perdida não deve gerar uma segunda conta nem ser interpretada automaticamente como falha definitiva.

Os campos técnicos `cadastroPendente`, `cadastroId` e `exclusaoPendente` são administrados somente pelo servidor. `_controle_usuarios/administracao` serializa alterações administrativas críticas. Não editar esses documentos manualmente para resolver falhas sem verificar Auth e os vínculos correspondentes.

Após cadastrar, o administrador pode tocar em **Enviar instruções de senha**. O envio utiliza a recuperação de senha do Firebase, sem gerar ou compartilhar uma senha padrão. Se o e-mail não puder ser enviado, a conta continua cadastrada e o usuário pode usar **Esqueceu a senha?** no login. Nenhum envio é feito automaticamente durante a instalação ou os testes em produção.

## Instalação e validação local

Pré-requisitos: Node 22 para o servidor e Java compatível com o Emulator Suite.

Na pasta `functions`:

```powershell
npm ci
npm run test:emulators
```

Em computadores com inicialização lenta, defina `$env:FUNCTIONS_DISCOVERY_TIMEOUT = '120'` antes do comando. Se o Java padrão não for compatível, aponte `JAVA_HOME` e o `PATH` do terminal para um JDK 21, sem alterar a configuração global do computador.

Os testes usam obrigatoriamente `demo-safracerta` e emuladores. Eles recusam executar sem os endereços de Auth e Firestore locais. Verificam permissões e regras, cadastro em Auth e Firestore, definição de senha, unicidade concorrente, repetição de requisições, retomada de falhas parciais, edição, proteção do último ADMIN, exclusão, leitura direta da coleção e recusa de dados desatualizados. As contas e senhas dos testes existem somente nos emuladores.

Para usar o aplicativo com emuladores, inicie-os a partir de `functions`:

```powershell
npx firebase emulators:start --config ../firebase.json --project demo-safracerta --only auth,firestore,functions
```

No terminal do Expo, defina `EXPO_PUBLIC_FIREBASE_PROJECT_ID=demo-safracerta`, valores de configuração Firebase de teste e `EXPO_PUBLIC_FIREBASE_EMULATOR_HOST=10.0.2.2` no Android Emulator (`127.0.0.1` na web). Reinicie o Expo. O host dos emuladores só é considerado em desenvolvimento. Os emuladores escutam somente no computador local; para celular físico, ajuste explicitamente os hosts em `firebase.json` e use o IP do computador em uma rede confiável, sem expor essas portas à internet. O conjunto local não importa nem altera usuários de produção.

Na raiz do projeto:

```powershell
npm run lint
npx tsc --noEmit
npx expo export --platform android --output-dir .expo/qa-usuarios-android
```

## Publicação no Firebase real

A implementação local não publica funções nem regras automaticamente. Não trocar plano ou habilitar faturamento automaticamente.

### Somente listagem e visualização

Para a consulta direta funcionar, publique as regras. Na pasta `functions`, com uma conta autorizada no projeto:

```powershell
npx firebase login
npx firebase deploy --config ../firebase.json --project safracerta-ee9ce --only firestore:rules
```

Esse comando publica apenas as regras. Não publica funções e não exige ativar Blaze para a listagem. Confira que o administrador tem perfil ativo em `usuarios/{uid}` e reinicie ou recarregue o aplicativo para usar o código atualizado.

### Cadastro, alteração e exclusão de contas

Essas operações usam Cloud Functions, cuja publicação exige projeto com faturamento no plano Blaze. O usuário autorizou Cloud Functions, Blaze e a publicação em 21/10/2026. Há custos potenciais de execução, rede, armazenamento de artefatos e leituras do Firestore; `maxInstances: 5` limita instâncias simultâneas, mas não é um teto de gastos. A publicação é separada da liberação da consulta e depende de uma conta de faturamento vinculada ao projeto.

1. Confirmar que o projeto real já tem Auth com e-mail/senha habilitado e o administrador existente com perfil ADMIN ativo. Esta implementação não cria nem promove administradores em produção.
2. Confirmar o esquema dos perfis existentes, a correspondência entre UID e Auth e a unicidade das matrículas. Não há migração automática.
3. Confirmar o modelo de e-mail de redefinição de senha e o domínio autorizado do Firebase Auth.
4. Revisar as alterações de `firestore.rules`: elas também bloqueiam alterações diretas de matrícula e e-mail feitas pelo titular, preservando a integridade do login por matrícula.
5. Com Blaze ativo, na pasta `functions`, usar o ID do projeto explicitamente. Para publicar somente as três operações administrativas:

```powershell
npx firebase login
npx firebase deploy --config ../firebase.json --project safracerta-ee9ce --only functions:usuarios
```

6. As regras têm publicação separada pelo comando da seção de listagem. Usar a configuração real do Firebase no aplicativo, sem `EXPO_PUBLIC_FIREBASE_EMULATOR_HOST`, e verificar os fluxos com contas de teste autorizadas. A região do cliente e do servidor deve permanecer igual. Nenhum índice composto é necessário para as consultas implementadas.

Documentação oficial consultada: [Consultas ao Firestore](https://firebase.google.com/docs/firestore/query-data/get-data), [cota gratuita do Firestore](https://firebase.google.com/docs/firestore/quotas), [regras de acesso](https://firebase.google.com/docs/firestore/security/rules-conditions), [Administração de contas](https://firebase.google.com/docs/auth/admin/manage-users), [funções chamáveis](https://firebase.google.com/docs/functions/callable), [transações](https://firebase.google.com/docs/firestore/manage-data/transactions), [publicação de funções](https://firebase.google.com/docs/functions/get-started) e [rotas autenticadas do Expo](https://docs.expo.dev/router/advanced/authentication/).

## Validação inicial registrada em 21/10/2026

- 17 testes de integração aprovados em Auth, Firestore e Functions locais, usando Node 24.21 e Java 21. O servidor de publicação está configurado para Node 22; o emulador utilizou a versão disponível no computador.
- A primeira tentativa não carregou as funções no limite padrão de 10 segundos. A execução aprovada usou `FUNCTIONS_DISCOVERY_TIMEOUT=120`.
- Lint completo (`npm run lint`), verificação de tipos (`tsc --noEmit --incremental false`) e conferência de diferenças (`git diff --check`): aprovados na conferência final.
- Pacote Android final gerado com sucesso após os ajustes de apresentação.
- A inspeção visual no Android não foi concluída: a captura via ADB ficou sem resposta e o usuário interrompeu a tentativa com Computer Use por meio de Esc. Nenhuma validação visual de listagem, formulário ou diálogos é declarada como aprovada. Não houve teste em dispositivo iOS.
- As contas de demonstração foram preparadas somente no emulador; os emuladores foram encerrados sem exportar dados. Não houve publicação, alteração de faturamento, envio de e-mail real ou modificação de usuários de produção.

## Validação da consulta direta em 21/10/2026

- 19 testes de integração aprovados nos emuladores, incluindo leitura direta, bloqueio de funcionário e visitante, perda de autorização ao alterar o perfil e conflitos de edição/exclusão com os dados originais da consulta.
- Lint, tipos sem emissão e `git diff --check` aprovados.
- Pacote Android gerado com sucesso em `.expo/qa-usuarios-android`. O Metro reconstruiu seu cache após detectar formato incompatível; a exportação terminou sem erro.
- A execução utilizou Node 24 disponível no computador; a configuração de publicação permanece Node 22. Os emuladores foram encerrados automaticamente.
- Sem nova inspeção visual, publicação em produção ou alteração de plano.

## Publicação e verificação em produção em 21/10/2026

- Vínculo de faturamento autorizado pelo usuário e confirmado como ativo, usando “Minha conta de faturamento do Maps”.
- Três funções publicadas e confirmadas como ACTIVE. Conferidos Node.js 22, região, conta de execução, mínimo zero e máximo cinco instâncias.
- Os três endereços HTTPS retornaram HTTP 401 e `UNAUTHENTICATED` para chamadas sem sessão, confirmando que estão acessíveis e exigem login. Não foram executados cadastros, alterações ou exclusões de usuários reais nessa verificação. A cobertura das regras de negócio permanece nos 19 testes locais de integração.
- O comando de implantação criou as três funções, mas terminou com código 1 somente porque não havia política de limpeza de artefatos. Essa pendência foi resolvida pelo comando abaixo, que terminou com sucesso:

```powershell
npx firebase functions:artifacts:setpolicy --config ../firebase.json --project safracerta-ee9ce --location southamerica-east1 --days 1 --force --non-interactive
```

- Lint, verificação de tipos sem emissão e `git diff --check` aprovados. A interface não foi inspecionada visualmente neste procedimento.

## Talhões — entrega de 22/10/2026

O mesmo codebase também contém `cadastrarTalhao`, `alterarTalhao` e `excluirTalhao`. As consultas são feitas diretamente em `talhoes` pelo SDK Firestore, para perfis ativos ADMIN e FUNCIONARIO; apenas Admin pode gravar pelas funções. Funcionário tem os controles administrativos visíveis e desativados na interface.

As transações mantêm `talhoes`, `_talhoes_por_codigo` e `_operacoes_talhoes` consistentes. Código é único, a versão numérica protege edições concorrentes e análises em `analises.talhaoId` bloqueiam exclusão, permitindo inativação. Os recibos de operação permanecem após excluir um talhão para impedir reaplicar solicitações antigas.

`talhoes-validacao.js` é um módulo puro compartilhado com o aplicativo; não contém credenciais ou dependências administrativas. A criação de talhões não cria contas Auth. O guia completo de uso, campos e coleções está em [TUTORIAL_TALHOES.md](../TUTORIAL_TALHOES.md).

Validação: 11 testes novos de Talhões e os 19 de Usuários passaram nos emuladores, assim como lint, tipos e bundle Android. As seis funções e as regras foram publicadas com sucesso em `safracerta-ee9ce`; as três novas funções retornaram HTTP 401 UNAUTHENTICATED em chamadas sem sessão. Não foram criados dados fictícios em produção. A conferência visual ficou pendente porque a revisão automática bloqueou a abertura do app no emulador, sem motivo específico informado.
