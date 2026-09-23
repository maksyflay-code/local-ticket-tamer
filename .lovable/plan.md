# Preenchimento automático do período no RFO

## Objetivo
Ao digitar o número de um chamado no campo **Protocolo interno**, localizar o chamado automaticamente e preencher **Início do evento** e **Fim do evento**.

## Implementação
- Aceitar o número puro ou formatos já usados, como `#1234` e `CHM-000123`.
- Após uma pequena pausa na digitação, consultar o chamado pelo campo `numero`.
- Preencher o início com `iniciado_at`; quando ausente, usar `created_at`.
- Preencher o fim com `finalizado_at`; quando ausente, usar `resolvido_at`.
- Manter os campos editáveis após o preenchimento automático.
- Exibir uma indicação curta quando o chamado for encontrado ou quando o número não existir, sem bloquear o restante do formulário.

## Validação
- Testar no navegador a busca por um chamado existente e um inexistente.
- Confirmar que as datas aparecem no formato aceito pelos campos atuais.
- Entregar os comandos prontos de atualização e reconstrução do aplicativo na VM em `/home/ivi/sistema`.
