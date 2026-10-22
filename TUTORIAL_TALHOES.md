# Talhões — uso e estrutura do Firebase

## Acesso no aplicativo

Abra **Talhões** no menu lateral.

- **Admin:** consulta, pesquisa, cadastra, altera e exclui talhões sem análises vinculadas.
- **Funcionário:** consulta e pesquisa. Cadastrar, Alterar e Excluir aparecem desativados; Visualizar permanece disponível.
- Ambos podem consultar ativos/inativos nessa tela. Somente ativos aparecem para seleção no Teste Folha.

## Cadastrar o primeiro talhão

1. Entre com uma conta Admin ativa.
2. Abra Talhões e toque no botão **+**, ao lado da pesquisa.
3. Preencha Código, Nome e Nome da propriedade. Situação começa como Ativo.
4. Se conhecidos, informe localidade, município/UF, área em hectares e observações. Município e UF devem ser preenchidos juntos.
5. Toque em Cadastrar talhão e aguarde a confirmação.

Código aceita de 2 a 20 letras sem acento, números e hífen, sem espaços internos. Ele é convertido para maiúsculas e não pode se repetir, mesmo em talhão inativo. Exemplo: `TAL-002`.

Área aceita vírgula, como `2,5`, e até 4 casas decimais. Deixe em branco quando desconhecida. Não informe zero como substituto de área desconhecida.

## Usar no Teste Folha

1. Abra Teste Folha e toque em Selecionar um talhão.
2. Pesquise por código, nome ou propriedade e escolha um dos talhões ativos.
3. Fotografe ou selecione uma imagem. A foto também pode ser escolhida antes do talhão.
4. Toque em Escanear folha agora. O cadastro será conferido novamente no banco antes do envio da imagem.
5. O resultado mostrará o talhão usado naquela análise. Se trocar o talhão, a classificação anterior será limpa, mantendo a foto para uma nova análise.

Sem talhões ativos, Admin pode abrir o cadastro pelo seletor; Funcionário deve solicitar cadastro ou ativação ao Admin. Sem conexão, a tela permite tentar novamente e mantém a foto.

O contexto do talhão fica na tela nesta entrega. Ainda não há gravação de histórico de análises ou fotos no Firebase.

## Alterar, inativar e excluir

No menu de ações do talhão, use Visualizar, Alterar ou Excluir. Alterar mantém o ID, mesmo ao trocar o código. Se outro Admin tiver alterado o cadastro, o servidor recusará a versão antiga; feche o formulário, atualize a lista e confira os novos valores.

Inativar retira o talhão das novas seleções do Teste Folha, mantendo seu cadastro. Quando houver análises vinculadas por `analises.talhaoId`, a exclusão física será bloqueada; use Inativo para preservar o histórico.

Se a confirmação de gravação não chegar, o formulário conserva a operação e os dados. Tente novamente com os mesmos dados. Antes de iniciar outro cadastro, confira a lista; repetir a mesma operação não duplica os registros.

## Preciso criar coleções manualmente?

**Não.** Depois de publicar as funções e regras, o primeiro cadastro pelo aplicativo cria os documentos e as coleções necessárias. Não é preciso criar coleções vazias no Console nem cadastrar um talhão no Firebase Auth.

No projeto Firebase `safracerta-ee9ce`, abra **Firestore Database → Dados** para conferir as três coleções abaixo. As coleções técnicas não ficam acessíveis pelo aplicativo.

### `talhoes/{talhaoId}`

O ID é automático e permanece o mesmo durante a vida do cadastro.

| Campo | Tipo Firestore | Exemplo / regra |
| --- | --- | --- |
| `codigo` | String | `TAL-002`, obrigatório e único. |
| `nome` | String | `Talhão da baixada`, obrigatório, de 2 a 80 caracteres. |
| `propriedadeNome` | String | `Propriedade Exemplo`, obrigatório, de 2 a 100 caracteres. |
| `localidade` | String | Até 120 caracteres; `""` se não informada. |
| `municipio` | String | Até 100 caracteres; `""` se não informado. |
| `uf` | String | Sigla brasileira válida ou `""`; preencher junto do município. |
| `areaHa` | Number ou Null | `2.5` ou `null`; nunca texto com unidade. |
| `status` | String | `ATIVO` ou `INATIVO`. |
| `observacoes` | String | Até 500 caracteres ou `""`. |
| `criadoEm` | Timestamp | Data da criação definida pelo servidor. |
| `atualizadoEm` | Timestamp | Data da última alteração definida pelo servidor. |
| `criadoPor` | String | UID do Admin que cadastrou. |
| `atualizadoPor` | String | UID do Admin da última alteração. |
| `versao` | Number inteiro | Inicia em 1 e aumenta a cada alteração. |

### `_talhoes_por_codigo/{codigo}`

Reserva técnica de código único. Exemplo de caminho: `_talhoes_por_codigo/TAL-002`.

| Campo | Tipo | Conteúdo |
| --- | --- | --- |
| `talhaoId` | String | Mesmo ID do documento correspondente em `talhoes`. |
| `criadoEm` | Timestamp | Data de criação da reserva no servidor. |

Trocar o código atualiza a reserva junto do cadastro. Excluir um talhão permitido remove sua reserva. Um talhão inativo conserva o código reservado.

### `_operacoes_talhoes/{operacaoId}`

Recibo técnico para reconhecer uma solicitação repetida após timeout ou reconexão.

| Campo | Tipo | Conteúdo |
| --- | --- | --- |
| `usuarioId` | String | UID do Admin solicitante. |
| `tipo` | String | `CADASTRAR`, `ALTERAR` ou `EXCLUIR`. |
| `talhaoId` | String | ID do talhão afetado. |
| `entradaHash` | String | SHA-256 dos parâmetros normalizados. |
| `concluida` | Boolean | `true` para transação concluída. |
| `criadaEm` | Timestamp | Data da operação no servidor. |
| `resultado` | Map | `talhaoId` (String) e `concluido` (Boolean). |

Não apagar esses recibos ao excluir um talhão: eles impedem reaplicar solicitações antigas. Não editar manualmente os campos de controle ou criar apenas o documento principal sem a reserva de código.

### Coleções existentes e futuras

`usuarios/{uid}` continua fornecendo as permissões do perfil. `login_por_matricula` permanece como está. Nenhum outro usuário Auth é criado para o talhão.

Não é necessário criar `analises` ou `propriedades` nesta etapa. A consulta de vínculos usa `analises.talhaoId` se esses dados existirem. A futura gravação de análises deverá validar o talhão na mesma transação da gravação para coordenar alterações/exclusões simultâneas.

## Publicação e verificação técnica

As gravações utilizam `cadastrarTalhao`, `alterarTalhao` e `excluirTalhao`, funções callable na região `southamerica-east1`. A consulta usa o SDK Firestore com as permissões de leitura do perfil ativo. Escritas diretas pelo cliente, inclusive Admin, são recusadas; as funções validam novamente o Admin.

Na pasta `functions`, para testar somente em emuladores:

```powershell
npm run test:emulators
```

O projeto de teste é `demo-safracerta`; as contas e dados usados pelos testes são locais. Os testes verificam também o módulo de Usuários.

Depois de qualquer publicação, conferir que as três funções estão disponíveis, que o cadastro funciona com Admin e que Funcionário consegue listar, mas não gravar. Não usar dados fictícios no banco real para conferir o fluxo; o primeiro cadastro real deverá ser feito pelo administrador do sistema.

Nesta entrega, as funções e regras foram publicadas em 22/10/2026. Para repetir uma publicação autorizada, execute na raiz do projeto:

```powershell
.\functions\node_modules\.bin\firebase.cmd deploy --config firebase.json --project safracerta-ee9ce --only "functions:usuarios,firestore:rules"
```

O codebase se chama `usuarios` e contém as seis funções de Usuários e Talhões. O comando publica ambos os módulos; não remove cadastros existentes.

Validação realizada: 30 testes nos emuladores, lint, tipos e bundle Android aprovados. As três funções publicadas recusaram chamadas sem autenticação com HTTP 401. Não foram criados talhões de demonstração em produção. A conferência visual no aparelho ficou pendente porque a revisão automática bloqueou a abertura do aplicativo no emulador.
