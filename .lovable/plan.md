

# Plano: Atualizar URL do ngrok para Evolution API

## Resumo

Você forneceu o novo link do ngrok: `https://d0992063157d.ngrok-free.app`

Este URL precisa ser atualizado em **1 arquivo principal** no backend para que a conexão com a Evolution API funcione corretamente.

---

## O que será atualizado

### 1. Arquivo `.htaccess` do Backend
**Arquivo:** `backend/api/.htaccess`

**URL atual (antiga):**
```
https://b59ebe4aa6a0.ngrok-free.app
```

**Novo URL:**
```
https://d0992063157d.ngrok-free.app
```

Esta é a variável de ambiente `EVOLUTION_API_URL` que o PHP usa para conectar com sua Evolution API rodando no Docker.

---

## Diagrama do Fluxo

```text
+-------------------+     +--------------------+     +-------------------+
|  Frontend React   | --> |  Backend PHP       | --> |  Evolution API    |
|  (Lovable)        |     |  (stacklabz.io)    |     |  (ngrok/Docker)   |
+-------------------+     +--------------------+     +-------------------+
                               |
                               | Usa EVOLUTION_API_URL
                               | do .htaccess
                               v
                          https://d0992063157d.ngrok-free.app
```

---

## Ação

Vou atualizar o arquivo `backend/api/.htaccess` para usar o novo URL do ngrok.

---

## Após a atualização

1. Faça upload do arquivo `.htaccess` atualizado para seu servidor
2. Tente conectar o WhatsApp novamente na página de configuração
3. Verifique o arquivo `debug.log` no backend para ver se as requisições estão indo para o URL correto

---

## Detalhes Técnicos

- **Arquivo a modificar:** `backend/api/.htaccess` (linha 5)
- **Variável:** `EVOLUTION_API_URL`
- **Valor antigo:** `https://b59ebe4aa6a0.ngrok-free.app`
- **Valor novo:** `https://d0992063157d.ngrok-free.app`

**Nota:** O webhook URL (`https://stackclinic.stacklabz.io/api/webhook/whatsapp`) permanece inalterado pois é o URL público do seu backend PHP que a Evolution API usa para enviar eventos de volta.

