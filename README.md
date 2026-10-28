# ⚽ Futebol Entre Amigos

Plataforma completa para gestão de peladas e rachas de futebol com amigos.

## 🚀 Tecnologias

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS
- **Ícones & Animações**: Lucide React + Canvas Confetti
- **Backend & Database**: Supabase (PostgreSQL, Row Level Security, Realtime)
- **Hospedagem**: Vercel

## ⚙️ Variáveis de Ambiente

Crie ou configure o arquivo `.env`:

```env
VITE_SUPABASE_URL=https://wlccughbhcqgwfgspjok.supabase.co
VITE_SUPABASE_ANON_KEY=seu_anon_key_aqui
```

## 🛠️ Comandos

```bash
# Instalar dependências
npm install

# Iniciar servidor de desenvolvimento
npm run dev

# Gerar build de produção
npm run build
```

## 🌐 Deploy na Vercel

1. Suba o projeto para o GitHub:
   ```bash
   git remote add origin https://github.com/<seu-usuario>/futebol-entre-amigos.git
   git push -u origin main
   ```
2. Na Vercel (`https://vercel.com`), clique em **Add New... > Project** e importe o repositório.
3. Configure as variáveis de ambiente em **Environment Variables**:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Clique em **Deploy**. O arquivo `vercel.json` já está configurado para gerenciar as rotas SPA.
