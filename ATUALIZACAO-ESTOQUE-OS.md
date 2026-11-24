# Estoque e solicitações B2B na VM

O erro `relation "public.estoque_itens" does not exist` indica que a atualização do banco local não foi aplicada. Recompilar somente o aplicativo não cria as tabelas.

Na VM, execute:

```bash
cd /home/ivi/sistema && git pull --ff-only && bash scripts/atualizar-vm.sh
```

O comando aplica as atualizações SQL antes de recriar o aplicativo e reinicia o gateway. Se qualquer etapa falhar, ele para: envie a saída sem senhas ou chaves. Não restaure arquivos antigos por cima da atualização.

Depois atualize com **Ctrl+F5**. Em **Estoque**, confira os oito materiais. O saldo 18 de CAIXA DE EMENDA é apenas o inicial: a atualização não reinicia saldos já existentes.

## Solicitações / OS

Além das solicitações existentes, há: ativação de circuito B2B (trânsito IP, transporte de dados ou link dedicado), ampliação de capacidade, reparo de fibra/backbone, configuração BGP/IP, conexão PTT/IX.br, colocation/intervenção no POP e proteção/mitigação DDoS.

Selecione um provedor cadastrado em **Clientes** na abertura da solicitação B2B. No detalhe da solicitação, a seção **Materiais utilizados na OS** permite informar um ou vários materiais e quantidades. O botão **Registrar utilização e baixar estoque** confirma o consumo imediatamente e grava o vínculo com o número da OS e seu histórico. Não é uma reserva nem uma baixa automática ao concluir: registre somente o consumo real.

Saídas acima do saldo são recusadas; repetir o envio da mesma operação não duplica a baixa. OS concluídas ou canceladas ficam somente para consulta. Materiais com movimentações não podem ser excluídos. Correções de saldo continuam disponíveis em Estoque, pelo ajuste, sem apagar o histórico.

## Validação

Testes isolados executam as mesmas atualizações SQL e verificam saldo, vínculo, histórico, permissões, proprietário e reenvio. Isso não substitui a verificação com uma sessão real na VM.

Authenticated path: UNVERIFIED — não há acesso à sessão ou ao banco da VM neste ambiente.
Guest path: não oferecido; a função recusa operações sem identidade autenticada.

Teste na VM: crie uma OS de reparo para um provedor, registre duas caixas, reabra a OS e confira o consumo no histórico e a redução de duas unidades em Estoque.