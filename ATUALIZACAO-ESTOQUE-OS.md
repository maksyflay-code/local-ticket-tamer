# Estoque e solicitações B2B na VM

O erro `relation "public.estoque_itens" does not exist` indica que a atualização do banco local não foi aplicada. Recompilar somente o aplicativo não cria as tabelas.

Na VM, execute:

```bash
cd /home/ivi/sistema && git pull --ff-only && bash scripts/atualizar-vm.sh
```

O comando aplica as atualizações SQL antes de recriar o aplicativo e reinicia o gateway. Se qualquer etapa falhar, ele para: envie a saída sem senhas ou chaves. Não restaure arquivos antigos por cima da atualização.

Se a saída anterior mostrou somente a primeira migração e depois `relation "public.estoque_movimentos" does not exist`, o Docker consumiu a lista de arquivos durante a consulta de controle. O atualizador corrigido mantém essa lista separada e retoma apenas as migrações pendentes, sem reaplicar as já registradas. A confirmação esperada é `Migrações concluídas: estoque e materiais da OS instalados.`; a mensagem só aparece depois de conferir as duas tabelas e a função de baixa.

Depois atualize com **Ctrl+F5**. Em **Estoque**, confira os oito materiais. O saldo 18 de CAIXA DE EMENDA é apenas o inicial: a atualização não reinicia saldos já existentes.

## Solicitações / OS

Além das solicitações existentes, há: ativação de circuito B2B (trânsito IP, transporte de dados ou link dedicado), ampliação de capacidade, reparo de fibra/backbone, configuração BGP/IP, conexão PTT/IX.br, colocation/intervenção no POP e proteção/mitigação DDoS.

Selecione um provedor cadastrado em **Clientes** na abertura da solicitação B2B. No detalhe da solicitação, a seção **Materiais utilizados na OS** permite informar um ou vários materiais e quantidades. O botão **Registrar utilização e baixar estoque** confirma o consumo imediatamente e grava o vínculo com o número da OS e seu histórico. Não é uma reserva nem uma baixa automática ao concluir: registre somente o consumo real.

Saídas acima do saldo são recusadas; repetir o envio da mesma operação não duplica a baixa. OS concluídas ou canceladas ficam somente para consulta. Materiais com movimentações não podem ser excluídos. Correções de saldo continuam disponíveis em Estoque, pelo ajuste, sem apagar o histórico.

## Validação

Regra: instalar ou atualizar o sistema deve preparar todo o estoque no banco local antes de disponibilizar a tela ou a baixa pela OS, sem reaplicar atualizações concluídas.

Pontos conferidos por leitura do código nesta correção:

- Instalação inicial (`scripts/install-vm.sh`): chama o mesmo aplicador antes de compilar o aplicativo; recebe a correção sem outro ajuste.
- Atualização (`scripts/atualizar-vm.sh`): aplica o banco antes de recriar o aplicativo e para se houver erro; recebe a correção sem outro ajuste.
- Aplicação direta (`scripts/apply-migrations.sh`): falhava porque a consulta de controle consumia a lista de arquivos. Corrigida e testada para instalação nova, retomada, repetição e interrupção por erro SQL.
- Tela Estoque (`src/routes/estoque.tsx`): usa as duas tabelas locais e bloqueia o cadastro quando não consegue carregar o estoque; não cria tabelas pela tela.
- Materiais na OS (`src/components/MateriaisOS.tsx` e integração em `src/routes/solicitacoes.tsx`): depende das mesmas tabelas e da função instalada; impede registrar consumo quando o carregamento falha.
- Acesso aos dados (`src/lib/estoque-client.ts`): utiliza o cliente do sistema com tipos adicionais para a VM; não instala nem semeia dados.
- Atualizações SQL de estoque, tipos B2B e consumo na OS: conferidas; passam nos testes isolados. O movimento de saldo e a função `registrar_materiais_os` dependem das tabelas instaladas pela primeira atualização de estoque.
- Importação de dados/arquivos e correção de permissões: não aplicam migrações e não dependem da lista de arquivos defeituosa; sem alteração nesta correção.

Não foi encontrado outro caminho de estoque ou tarefa automática de baixa na busca pelo código. Não foram alteradas permissões, saldos existentes, exemplos nem OS encerradas nesta correção. A execução com Docker real e a leitura pela tela na VM ainda dependem da atualização pelo usuário.

Testes isolados executam as mesmas atualizações SQL e verificam saldo, vínculo, histórico, permissões, proprietário e reenvio. Isso não substitui a verificação com uma sessão real na VM.

Authenticated path: UNVERIFIED — não há acesso à sessão ou ao banco da VM neste ambiente.
Guest path: não oferecido; a função recusa operações sem identidade autenticada.

Teste na VM: crie uma OS de reparo para um provedor, registre duas caixas, reabra a OS e confira o consumo no histórico e a redução de duas unidades em Estoque.