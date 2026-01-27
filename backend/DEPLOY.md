# 🚀 StackClinic - Guia de Deploy na Hostinger

## 📋 Pré-requisitos
- Acesso ao painel da Hostinger
- Acesso ao phpMyAdmin
- Cliente FTP (FileZilla) ou Gerenciador de Arquivos da Hostinger

---

## 🗄️ PASSO 1: Configurar o Banco de Dados

### 1.1 Acessar phpMyAdmin
1. Acesse o painel da Hostinger
2. Vá em **Banco de Dados** → **phpMyAdmin**
3. Selecione o banco `u226840309_stackclinic`

### 1.2 Executar o SQL
1. Clique na aba **SQL**
2. Copie todo o conteúdo do arquivo `backend/database.sql`
3. Cole no campo de texto e clique em **Executar**
4. ✅ Deve aparecer mensagem de sucesso criando 22 tabelas

### 1.3 Verificar Tabelas Criadas
Confirme que estas tabelas foram criadas:
- `clinica`, `usuarios`, `pacientes`
- `agendamentos`, `lista_espera`, `ia_sugestoes`
- `anamnese`, `anamnese_perguntas`, `anamnese_alertas`
- `timeline`, `galeria`, `transcricoes`
- `financeiro_transacoes`, `recibos`
- `campanhas_marketing`, `marketing_config`
- `biblioteca_arquivos`, `biblioteca_atalhos`
- `parceiros`, `indicacoes`
- `smart_feed`, `avaliacoes`
- `ia_config`, `live_chats`
- `horario_funcionamento`

---

## 📁 PASSO 2: Upload dos Arquivos PHP

### 2.1 Via Gerenciador de Arquivos (mais fácil)
1. No painel Hostinger, vá em **Arquivos** → **Gerenciador de Arquivos**
2. Navegue até `public_html/`
3. Crie a pasta `api/` se não existir
4. Faça upload de todos os arquivos da pasta `backend/api/`

### 2.2 Via FTP (FileZilla)
```
Host: ftp.stacklabz.io (ou o que a Hostinger fornecer)
Usuário: seu_usuario_ftp
Senha: sua_senha_ftp
Porta: 21
```

Upload da estrutura:
```
public_html/
└── api/
    ├── .htaccess
    ├── index.php
    ├── config/
    │   ├── Database.php
    │   └── cors.php
    ├── helpers/
    │   ├── Response.php
    │   └── Auth.php
    ├── dashboard/
    │   ├── summary.php
    │   ├── smart-feed.php
    │   └── humor.php
    ├── appointments/
    │   ├── index.php
    │   ├── detail.php
    │   ├── waiting-list.php
    │   └── notify-waiting-list.php
    ├── patients/
    │   ├── index.php
    │   ├── detail.php
    │   ├── timeline.php
    │   ├── anamnesis.php
    │   ├── gallery.php
    │   ├── transcription-start.php
    │   ├── transcription-summary.php
    │   └── documents-generate.php
    ├── ai/
    │   ├── config.php
    │   ├── suggestions.php
    │   ├── approve-slot.php
    │   ├── reject-slot.php
    │   ├── live-chats.php
    │   └── takeover.php
    ├── finance/
    │   ├── summary.php
    │   ├── cash-flow.php
    │   ├── ocr.php
    │   ├── receipts.php
    │   └── generate-tiss.php
    ├── marketing/
    │   ├── stats.php
    │   ├── inactive-patients.php
    │   ├── send.php
    │   └── review-config.php
    ├── library/
    │   ├── files.php
    │   ├── upload.php
    │   └── shortcuts.php
    ├── partners/
    │   ├── program.php
    │   └── stats.php
    └── config/
        └── clinic.php
```

### 2.3 Criar pasta de uploads
```
public_html/
└── uploads/
    └── library/   ← Para arquivos da biblioteca
```

Dê permissão 755 à pasta `uploads`:
```bash
chmod -R 755 public_html/uploads
```

---

## ✅ PASSO 3: Testar a API

### 3.1 Testar no navegador
Acesse: `https://stackclinic.stacklabz.io/api/dashboard/summary`

Deve retornar JSON:
```json
{
  "success": true,
  "data": {
    "faturamento": { "hoje": 0, "mes": 0, "variacao": 0 },
    "agendamentos": { "realizados": 0, "pendentes": 0, "total": 0 },
    "novosPacientes": { "total": 0, "crescimento": 0 }
  }
}
```

### 3.2 Endpoints para testar
| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/api/dashboard/summary` | GET | Resumo do dashboard |
| `/api/dashboard/smart-feed` | GET | Feed de notificações |
| `/api/appointments` | GET | Lista de agendamentos |
| `/api/patients` | GET | Lista de pacientes |
| `/api/finance/summary` | GET | Resumo financeiro |

---

## 🔧 PASSO 4: Configuração Final

### 4.1 Verificar mod_rewrite
Se as rotas não funcionarem, verifique se o `mod_rewrite` está ativo.
Na Hostinger, geralmente já vem habilitado.

### 4.2 Logs de Erro
Se algo der errado, verifique os logs em:
- Hostinger → **Avançado** → **Logs de Erros**
- Ou crie um arquivo de log customizado no PHP

### 4.3 Alterar Credenciais (Produção)
⚠️ **IMPORTANTE:** Altere a senha do banco em produção!

Edite `backend/api/config/Database.php`:
```php
private $password = "SUA_NOVA_SENHA_SEGURA";
```

---

## 🔐 PASSO 5: Segurança (Recomendado)

### 5.1 Alterar Secret JWT
Edite `backend/api/helpers/Auth.php`:
```php
private static $secret = 'sua_chave_secreta_unica_aqui';
```

### 5.2 Habilitar HTTPS
Na Hostinger, vá em **SSL** e ative o certificado gratuito Let's Encrypt.

### 5.3 Proteger Database.php
O `.htaccess` já bloqueia acesso direto, mas verifique se está funcionando:
- `https://stackclinic.stacklabz.io/api/config/Database.php` → Deve dar erro 403

---

## 📱 PASSO 6: Conectar Frontend

O frontend já está configurado para usar:
```
VITE_API_URL=https://stackclinic.stacklabz.io/api
```

Após o deploy da API, o sistema deve funcionar automaticamente!

---

## 🆘 Troubleshooting

### Erro 500
1. Verifique se o PHP está na versão 7.4+
2. Confira se a extensão PDO está habilitada
3. Verifique credenciais do banco em `Database.php`

### Erro 404
1. Confirme que o `.htaccess` foi enviado
2. Verifique se `mod_rewrite` está ativo

### Erro de CORS
1. Confirme que `cors.php` está sendo incluído
2. Verifique headers no `.htaccess`

### Conexão recusada
1. Verifique se o host do banco é `localhost`
2. Confirme usuário/senha do MariaDB

---

## 📞 Suporte

Se precisar de ajuda:
1. Verifique os logs de erro da Hostinger
2. Teste os endpoints individualmente
3. Confirme que o banco foi criado corretamente

**Deploy concluído! 🎉**
