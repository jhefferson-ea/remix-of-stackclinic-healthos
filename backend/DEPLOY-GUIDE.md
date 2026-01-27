# 🚀 Guia de Deploy Completo - StackClinic v2.0

Este documento contém o passo-a-passo para fazer o deploy completo do sistema na Hostinger.

---

## 📋 Pré-requisitos

- Acesso ao painel da Hostinger
- Acesso ao phpMyAdmin
- Node.js instalado localmente (para build)
- Git instalado (opcional)

---

## 1️⃣ ATUALIZAR O BANCO DE DADOS

### Executar no phpMyAdmin:

1. Acesse o phpMyAdmin da Hostinger
2. Selecione o banco `u226840309_stackclinic`
3. Vá na aba **SQL**
4. Cole o conteúdo do arquivo `backend/database-update-v2.sql`
5. Clique em **Executar**

> ⚠️ Este SQL cria as novas tabelas:
> - `bloqueios_agenda` - Para bloqueios de horário
> - `anamnese_config` - Configuração de anamnese
> - `anamnese_template` - Perguntas personalizadas

---

## 2️⃣ FAZER BUILD DO FRONTEND

No seu computador local:

```bash
# Entrar na pasta do projeto
cd stackclinic-dashboard

# Instalar dependências (se necessário)
npm install

# Gerar build de produção
npm run build
```

Isso vai criar a pasta `dist/` com os arquivos otimizados.

---

## 3️⃣ ESTRUTURA DE PASTAS NA HOSTINGER

A estrutura final deve ficar assim:

```
public_html/
├── index.html          (do dist/)
├── assets/             (do dist/)
│   ├── index-xxx.js
│   └── index-xxx.css
├── favicon.ico         (do dist/)
└── api/                (backend PHP)
    ├── .htaccess
    ├── index.php
    ├── auth/
    │   ├── login.php
    │   └── register.php
    ├── config/
    │   ├── cors.php
    │   ├── Database.php
    │   ├── clinic.php
    │   └── anamnese.php
    ├── helpers/
    │   ├── Auth.php
    │   └── Response.php
    ├── team/
    │   ├── index.php
    │   └── update.php
    ├── patients/
    │   ├── index.php
    │   ├── create.php
    │   └── ...
    ├── appointments/
    │   ├── index.php
    │   ├── create.php
    │   ├── block.php
    │   └── ...
    ├── ai/
    │   └── ...
    ├── dashboard/
    │   └── ...
    ├── finance/
    │   └── ...
    ├── marketing/
    │   └── ...
    ├── library/
    │   └── ...
    └── partners/
        └── ...
```

---

## 4️⃣ UPLOAD DOS ARQUIVOS

### Frontend (via File Manager ou FTP):

1. Acesse o **File Manager** da Hostinger
2. Entre em `public_html`
3. **DELETE** os arquivos antigos (index.html, assets/) mas **NÃO DELETE** a pasta `api/`
4. Faça upload do conteúdo da pasta `dist/`:
   - `index.html`
   - Pasta `assets/`
   - `favicon.ico`

### Backend (via File Manager ou FTP):

1. Entre em `public_html/api/`
2. Crie as pastas que faltam: `auth/`, `team/`
3. Faça upload dos novos arquivos PHP:
   - `api/auth/login.php`
   - `api/auth/register.php`
   - `api/team/index.php`
   - `api/team/update.php`
   - `api/patients/create.php`
   - `api/appointments/create.php`
   - `api/appointments/block.php`
   - `api/config/anamnese.php`

---

## 5️⃣ CONFIGURAR PERMISSÕES

Via File Manager ou SSH:

```bash
# Permissões para pastas
chmod 755 public_html/api
chmod 755 public_html/api/auth
chmod 755 public_html/api/team
chmod 755 public_html/api/config

# Permissões para arquivos PHP
chmod 644 public_html/api/**/*.php
```

---

## 6️⃣ CRIAR PASTA DE UPLOADS (se necessário)

```bash
# Criar pasta para uploads
mkdir -p public_html/uploads/logos
mkdir -p public_html/uploads/gallery
mkdir -p public_html/uploads/documents

# Dar permissão de escrita
chmod 755 public_html/uploads
chmod 755 public_html/uploads/logos
chmod 755 public_html/uploads/gallery
chmod 755 public_html/uploads/documents
```

---

## 7️⃣ VERIFICAR .htaccess

O arquivo `public_html/api/.htaccess` deve conter:

```apache
# CORS Headers
Header always set Access-Control-Allow-Origin "*"
Header always set Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS"
Header always set Access-Control-Allow-Headers "Content-Type, Authorization, Accept"

# Handle OPTIONS preflight
RewriteEngine On
RewriteCond %{REQUEST_METHOD} OPTIONS
RewriteRule ^(.*)$ $1 [R=200,L]

# Rewrite rules
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^(.*)$ index.php [QSA,L]
```

---

## 8️⃣ TESTAR O SISTEMA

1. Acesse: `https://stackclinic.stacklabz.io/`
2. Você deve ver a **Landing Page**
3. Clique em **Entrar** para ir para `/auth`
4. Use as credenciais:
   - Email: `admin@stackclinic.com.br`
   - Senha: `password`
5. Após login, você será redirecionado para `/app` (Dashboard)

---

## 🔧 TROUBLESHOOTING

### Tela Branca?
- Verifique o console do navegador (F12 > Console)
- Verifique se os arquivos assets foram carregados

### Erro 500 na API?
- Verifique os logs de erro: `public_html/api/error.log`
- Verifique as credenciais do banco em `api/config/Database.php`

### CORS Error?
- Verifique se o .htaccess está configurado corretamente
- Certifique-se de que `cors.php` está sendo incluído em todos os endpoints

### Login não funciona?
- Verifique se a tabela `usuarios` tem o usuário admin
- A senha padrão é: `password` (hash bcrypt no banco)

---

## 📝 Credenciais Padrão

| Campo | Valor |
|-------|-------|
| URL | https://stackclinic.stacklabz.io |
| Email Admin | admin@stackclinic.com.br |
| Senha Admin | password |
| Banco | u226840309_stackclinic |
| Usuário DB | u226840309_stackclinicusr |
| Senha DB | Stack@2025 |

---

## ✅ Checklist Final

- [ ] SQL executado no phpMyAdmin
- [ ] Build do frontend gerado
- [ ] Frontend (dist/) uploaded para public_html/
- [ ] Backend PHP uploaded para public_html/api/
- [ ] Pastas de upload criadas com permissões
- [ ] .htaccess configurado
- [ ] Teste de login funcionando
- [ ] Teste de criar paciente funcionando
- [ ] Teste de criar agendamento funcionando

---

**Desenvolvido por StackLabz © 2025**
