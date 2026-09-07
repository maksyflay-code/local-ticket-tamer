# Instalação na sua VM (banco de dados local)

Este sistema roda inteiramente na sua máquina: aplicação, banco de dados PostgreSQL,
login de usuários, arquivos anexados e atualizações em tempo real. Nada fica em nuvem.

## Pré-requisitos

- Uma VM com Linux (Ubuntu 22.04+ recomendado), 4 GB de RAM ou mais
- Docker e o plugin `docker compose` instalados

```bash
curl -fsSL https://get.docker.com | sh
```

## Instalação

```bash
git clone <endereço-do-repositório> sistema
cd sistema
sudo bash scripts/install-vm.sh
```

O instalador pergunta o endereço de acesso (por exemplo `http://192.168.0.10:8080`),
gera as senhas e chaves automaticamente, sobe o banco local, aplica toda a estrutura
de tabelas e por fim publica o sistema.

Ao terminar, acesse o endereço informado. O login e a aplicação usam a mesma
porta; não é necessário liberar a porta 8000 no firewall da VM.

## Primeiro usuário (administrador)

Crie o administrador direto pelo terminal da VM:

```bash
sudo bash scripts/criar-admin.sh maksyflay@ivitelecom.com.br "SuaSenhaForte123"
```

O mesmo comando também serve para trocar a senha de um usuário existente.


## Comandos do dia a dia

```bash
cd docker
docker compose ps                 # ver o que está rodando
docker compose logs -f app        # acompanhar o sistema
docker compose restart app        # reiniciar o sistema
docker compose down               # parar tudo (os dados são preservados)
```

## Atualizar o sistema

```bash
git pull
bash scripts/apply-migrations.sh
cd docker && docker compose up -d --build app gateway
```

## Backup do banco

```bash
cd docker
docker compose exec -T db pg_dump -U supabase_admin postgres > backup-$(date +%F).sql
```

Restaurar:

```bash
cd docker
docker compose exec -T db psql -U supabase_admin -d postgres < backup-2026-01-01.sql
```

## Configurações

Tudo fica em `docker/.env`: portas, endereço de acesso, senha do banco e chaves.
Ali também entram, se você usar, o token do Telegram e a chave de IA.
Depois de alterar o arquivo, rode `cd docker && docker compose up -d`.

## Onde ficam os dados

- Banco de dados: volume Docker `ivi-helpdesk_db-data`
- Arquivos anexados: volume Docker `ivi-helpdesk_storage-data`
