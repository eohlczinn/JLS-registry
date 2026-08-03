import express from 'express';
import cors from 'cors';
import bcrypt from 'bcrypt';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { OAuth2Client } from 'google-auth-library';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from './db.js';
import { required, optional, token, refreshToken, hashToken } from './auth.js';
import { answerSupport } from './support-knowledge.js';
import 'dotenv/config';

const app = express();
const server = createServer(app);
const origin = process.env.WEB_ORIGIN || 'http://localhost:5173';
const io = new Server(server, { cors: { origin } });
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const fail = (res, status, code, error) => res.status(status).json({ code, error });
let databaseReady = false;
const safeUser = ({ id, name, username, email, avatar_url }) => ({ id, name, username, email, avatarUrl: avatar_url || '' });
const adminOnly = async (req,res,next) => { try { const account=(await db.query('select email from users where id=$1',[req.user.id])).rows[0]; if(!process.env.ADMIN_EMAIL || account?.email.toLowerCase()!==process.env.ADMIN_EMAIL.toLowerCase()) return fail(res,403,'JL001','Apenas o administrador pode alterar as configurações do suporte.'); next(); } catch(error){next(error);} };
async function authResponse(user) {
  const refresh = refreshToken();
  await db.query("insert into sessions(user_id,refresh_token_hash,expires_at) values($1,$2,now() + interval '30 days')", [user.id, hashToken(refresh)]);
  return { user: safeUser(user), accessToken: token(user), refreshToken: refresh };
}

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(rateLimit({ windowMs: 60_000, max: 180, standardHeaders: true }));
app.get('/health', (_, res) => res.status(databaseReady ? 200 : 503).json({ status: databaseReady ? 'ok' : 'degraded', service: 'JL Registry API', database: databaseReady ? 'connected' : 'unavailable' }));
app.use((req,res,next)=>{if(!databaseReady)return fail(res,503,'JL009','Banco de dados indisponível. Inicie o PostgreSQL e confira DATABASE_URL no backend/.env.');next();});

async function history(userId, action, resource, details = {}) {
  await db.query('insert into history(user_id,action,resource,details) values($1,$2,$3,$4)', [userId, action, resource, JSON.stringify(details)]);
}
async function packageByName(name) {
  const result = await db.query(`select p.id,p.name,p.description,p.downloads,p.created_at,p.updated_at,u.username author,c.name category,
    v.version,v.readme,v.license,v.dependencies,v.created_at published_at
    from packages p join users u on u.id=p.user_id left join categories c on c.id=p.category_id
    left join lateral (select * from package_versions where package_id=p.id order by created_at desc limit 1) v on true where lower(p.name)=lower($1)`, [name]);
  return result.rows[0];
}

app.post('/auth/register', async (req, res, next) => {
  const { name, username, email, password } = req.body;
  if (![name, username, email, password].every(Boolean) || password.length < 6) return fail(res, 400, 'JL001', 'Preencha todos os campos e use uma senha com ao menos 6 caracteres.');
  try {
    const hash = await bcrypt.hash(password, 12);
    const result = await db.query('insert into users(name,username,email,password_hash) values($1,$2,$3,$4) returning *', [name.trim(), username.trim().toLowerCase(), email.trim().toLowerCase(), hash]);
    const user = result.rows[0]; await history(user.id, 'cadastro', user.username);
    res.status(201).json(await authResponse(user));
  } catch (error) { if (error.code === '23505') return fail(res, 409, 'JL007', 'Usuário ou e-mail já está em uso.'); next(error); }
});
app.post('/auth/login', async (req, res, next) => {
  try {
    const result = await db.query('select * from users where email=$1', [(req.body.email || '').trim().toLowerCase()]); const user = result.rows[0];
    if (!user || !await bcrypt.compare(req.body.password || '', user.password_hash)) return fail(res, 401, 'JL001', 'E-mail ou senha inválidos.');
    await history(user.id, 'login', user.username); res.json(await authResponse(user));
  } catch (error) { next(error); }
});
app.post('/auth/google', async (req, res, next) => {
  try {
    if (!process.env.GOOGLE_CLIENT_ID) return fail(res, 503, 'JL010', 'GOOGLE_CLIENT_ID não foi configurado no servidor.');
    const ticket = await googleClient.verifyIdToken({ idToken: req.body.credential, audience: process.env.GOOGLE_CLIENT_ID });
    const profile = ticket.getPayload();
    if (!profile?.email || !profile.email_verified) return fail(res, 401, 'JL001', 'A conta Google não possui e-mail verificado.');
    let record = (await db.query('select * from users where email=$1', [profile.email.toLowerCase()])).rows[0];
    if (!record) {
      const base = (profile.email.split('@')[0] || 'jlsuser').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20) || 'jlsuser';
      let username = base, index = 1;
      while ((await db.query('select 1 from users where username=$1', [username])).rowCount) username = `${base}${index++}`;
      const randomPassword = await bcrypt.hash(`google:${profile.sub}:${Date.now()}`, 12);
      record = (await db.query('insert into users(name,username,email,password_hash,avatar_url) values($1,$2,$3,$4,$5) returning *', [profile.name || username, username, profile.email.toLowerCase(), randomPassword, profile.picture || ''])).rows[0];
      await history(record.id, 'cadastro_google', record.username);
    }
    await history(record.id, 'login_google', record.username); res.json(await authResponse(record));
  } catch (error) { console.error('Google OAuth:', error.message); fail(res, 401, 'JL001', 'Não foi possível validar o login Google. Verifique a origem autorizada no Google Cloud.'); }
});
app.post('/auth/refresh', async (req, res, next) => {
  try {
    const raw = req.body.refreshToken;
    if (!raw) return fail(res, 401, 'JL001', 'Refresh token obrigatório.');
    const result = await db.query("select s.id,u.* from sessions s join users u on u.id=s.user_id where s.refresh_token_hash=$1 and s.revoked_at is null and s.expires_at > now()", [hashToken(raw)]);
    if (!result.rowCount) return fail(res, 401, 'JL001', 'Sessão expirada ou inválida.');
    await db.query('update sessions set revoked_at=now() where id=$1', [result.rows[0].id]);
    res.json(await authResponse(result.rows[0]));
  } catch (error) { next(error); }
});
app.post('/auth/logout', required, async (req, res, next) => { try { if (req.body.refreshToken) await db.query('update sessions set revoked_at=now() where refresh_token_hash=$1', [hashToken(req.body.refreshToken)]); await history(req.user.id, 'logout', req.user.username); res.status(204).end(); } catch (error) { next(error); } });

app.get('/categories', async (_, res, next) => { try { res.json({ items: (await db.query('select name,slug from categories order by name')).rows }); } catch (error) { next(error); } });
app.get('/packages', async (req, res, next) => {
  try { const page = Math.max(Number(req.query.page) || 1, 1), limit = Math.min(Math.max(Number(req.query.limit) || 12, 1), 50), q = `%${req.query.q || ''}%`, category = req.query.category || '';
    const where = '(p.name ilike $1 or p.description ilike $1) and ($2 = \'\' or c.slug=$2)';
    const count = await db.query(`select count(*) from packages p left join categories c on c.id=p.category_id where ${where}`, [q, category]);
    const rows = await db.query(`select p.name,p.description,p.downloads,u.username author,c.name category,v.version,v.created_at published_at from packages p join users u on u.id=p.user_id left join categories c on c.id=p.category_id left join lateral (select * from package_versions where package_id=p.id order by created_at desc limit 1) v on true where ${where} order by p.downloads desc,p.created_at desc limit $3 offset $4`, [q, category, limit, (page - 1) * limit]);
    res.json({ items: rows.rows, page, pages: Math.ceil(Number(count.rows[0].count) / limit), total: Number(count.rows[0].count) });
  } catch (error) { next(error); }
});
app.get('/packages/:name', async (req, res, next) => { try { const item = await packageByName(req.params.name); if (!item) return fail(res, 404, 'JL005', 'Biblioteca não encontrada.'); const versions = await db.query('select version,license,dependencies,created_at from package_versions where package_id=$1 order by created_at desc', [item.id]); const comments = await db.query('select c.body,c.rating,c.created_at,u.username from comments c join users u on u.id=c.user_id where c.package_id=$1 order by c.created_at desc', [item.id]); res.json({ ...item, versions: versions.rows, comments: comments.rows }); } catch (error) { next(error); } });

app.post('/packages/publish', required, async (req, res, next) => {
  const { name, version, description = '', readme = '', license = 'MIT', dependencies = [], category = 'utilitarios' } = req.body;
  if (!name || !version || !description) return fail(res, 400, 'JL001', 'Nome, versão e descrição são obrigatórios.');
  const client = await db.connect();
  try { await client.query('begin'); const existing = await client.query('select id,user_id from packages where lower(name)=lower($1)', [name]);
    let id;
    if (existing.rows[0]) { if (String(existing.rows[0].user_id) !== String(req.user.id)) { await client.query('rollback'); return fail(res, 409, 'JL007', 'Esta biblioteca já pertence a outro usuário.'); } id = existing.rows[0].id; await client.query('update packages set description=$1,updated_at=now() where id=$2', [description, id]); }
    else id = (await client.query('insert into packages(user_id,category_id,name,description) values($1,(select id from categories where slug=$2),$3,$4) returning id', [req.user.id, category, name, description])).rows[0].id;
    const already = await client.query('select 1 from package_versions where package_id=$1 and version=$2', [id, version]); if (already.rowCount) { await client.query('rollback'); return fail(res, 409, 'JL008', 'Essa versão já foi publicada.'); }
    await client.query('insert into package_versions(package_id,version,readme,license,dependencies) values($1,$2,$3,$4,$5)', [id, version, readme, license, JSON.stringify(Array.isArray(dependencies) ? dependencies : [])]);
    await client.query('commit'); await history(req.user.id, 'publicação', name, { version }); io.emit('package:published', { name, version }); res.status(201).json({ ok: true, name, version });
  } catch (error) { await client.query('rollback'); next(error); } finally { client.release(); }
});
app.put('/packages/:name', required, async (req, res, next) => {
  try {
    const item = await packageByName(req.params.name);
    if (!item) return fail(res, 404, 'JL005', 'Biblioteca não encontrada.');
    const owner = await db.query('select user_id from packages where id=$1', [item.id]);
    if (String(owner.rows[0].user_id) !== String(req.user.id)) return fail(res, 403, 'JL001', 'Você não pode atualizar esta biblioteca.');
    const description = req.body.description || item.description;
    await db.query('update packages set description=$1,updated_at=now() where id=$2', [description, item.id]);
    await history(req.user.id, 'atualização', item.name); io.emit('package:updated', { name: item.name });
    res.json({ ok: true, name: item.name, description });
  } catch (error) { next(error); }
});
app.post('/packages/compile', required, (req, res) => res.json({ ok: true, message: `Validação de ${req.body.name || 'pacote'} concluída. Use jls compile localmente para gerar o artefato.` }));
app.delete('/packages/:id', required, async (req, res, next) => { try { const byId=/^\d+$/.test(req.params.id); const item=byId?(await db.query(`select p.id,p.name from packages p where p.id=$1`,[req.params.id])).rows[0]:await packageByName(req.params.id); if (!item) return fail(res, 404, 'JL005', 'Biblioteca não encontrada.'); const owner = await db.query('select user_id from packages where id=$1', [item.id]); if (String(owner.rows[0].user_id) !== String(req.user.id)) return fail(res, 403, 'JL001', 'Você não pode excluir esta biblioteca.'); await db.query('delete from packages where id=$1', [item.id]); await history(req.user.id, 'exclusão', item.name); io.emit('package:deleted', { name: item.name }); res.status(204).end(); } catch (error) { next(error); } });
app.get('/search', async (req, res, next) => { try { req.query.limit = req.query.limit || 20; const q = `%${req.query.q || ''}%`; const rows = await db.query('select name,description,downloads from packages where name ilike $1 or description ilike $1 order by downloads desc limit 20', [q]); res.json({ items: rows.rows }); } catch (error) { next(error); } });
app.get('/packages/download', async (req, res, next) => { try { const item = await packageByName(req.query.name); if (!item) return fail(res, 404, 'JL005', 'Biblioteca não encontrada.'); await db.query('update packages set downloads=downloads+1 where id=$1', [item.id]); await db.query('insert into downloads(package_id) values($1)', [item.id]); io.emit('package:download', { name: item.name }); res.json({ ok: true, name: item.name, version: item.version, message: 'Download registrado. A integração de arquivo será ligada ao storage na produção.' }); } catch (error) { next(error); } });
app.get('/history', required, async (req, res, next) => { try { res.json({ items: (await db.query('select action,resource,details,created_at from history where user_id=$1 order by created_at desc limit 100', [req.user.id])).rows }); } catch (error) { next(error); } });
app.get('/profile', required, async (req, res, next) => { try { const user = (await db.query('select id,name,username,email,avatar_url,bio,created_at from users where id=$1', [req.user.id])).rows[0]; const preferences=(await db.query('select github,website,language,theme,notifications,privacy_profile from settings where user_id=$1',[req.user.id])).rows[0]||{}; const packages = await db.query('select name,description,downloads from packages where user_id=$1 order by updated_at desc', [req.user.id]); const stats = await db.query('select coalesce(sum(downloads),0)::int downloads,count(*)::int packages from packages where user_id=$1', [req.user.id]); res.json({ user: safeUser(user), bio: user.bio, createdAt: user.created_at, packages: packages.rows, stats: stats.rows[0], preferences }); } catch (error) { next(error); } });
app.put('/profile', required, async (req, res, next) => { try { const {name,bio,avatarUrl,email,password,github,website}=req.body; if(password && password.length<6)return fail(res,400,'JL001','A nova senha deve possuir ao menos 6 caracteres.'); const hash=password?await bcrypt.hash(password,12):null; const r = await db.query('update users set name=coalesce($1,name),bio=coalesce($2,bio),avatar_url=coalesce($3,avatar_url),email=coalesce($4,email),password_hash=coalesce($5,password_hash) where id=$6 returning *', [name,bio,avatarUrl,email,hash,req.user.id]); await db.query('insert into settings(user_id,github,website) values($1,$2,$3) on conflict(user_id) do update set github=coalesce(excluded.github,settings.github),website=coalesce(excluded.website,settings.website),updated_at=now()',[req.user.id,github||'',website||'']); await history(req.user.id,'perfil_atualizado',r.rows[0].username);res.json({ user: safeUser(r.rows[0]), bio: r.rows[0].bio }); } catch (error) { if(error.code==='23505')return fail(res,409,'JL001','Este e-mail já está em uso.');next(error); } });
app.get('/settings',required,async(req,res,next)=>{try{const result=await db.query('select github,website,language,theme,notifications,privacy_profile from settings where user_id=$1',[req.user.id]);res.json(result.rows[0]||{language:'pt-BR',theme:'dark',notifications:true,privacy_profile:true,github:'',website:''});}catch(error){next(error);}});
app.put('/settings',required,async(req,res,next)=>{try{const {github='',website='',language='pt-BR',theme='dark',notifications=true,privacy_profile=true}=req.body;if(!['pt-BR','en'].includes(language)||!['dark','light'].includes(theme))return fail(res,400,'JL001','Idioma ou tema inválido.');const r=await db.query('insert into settings(user_id,github,website,language,theme,notifications,privacy_profile) values($1,$2,$3,$4,$5,$6,$7) on conflict(user_id) do update set github=excluded.github,website=excluded.website,language=excluded.language,theme=excluded.theme,notifications=excluded.notifications,privacy_profile=excluded.privacy_profile,updated_at=now() returning github,website,language,theme,notifications,privacy_profile',[req.user.id,github,website,language,theme,notifications,privacy_profile]);res.json(r.rows[0]);}catch(error){next(error);}});
app.put('/theme',required,async(req,res,next)=>{req.body={...(await db.query('select github,website,language,notifications,privacy_profile from settings where user_id=$1',[req.user.id])).rows[0],theme:req.body.theme};try{const theme=req.body.theme;if(!['dark','light'].includes(theme))return fail(res,400,'JL001','Tema inválido.');await db.query('insert into settings(user_id,theme) values($1,$2) on conflict(user_id) do update set theme=excluded.theme,updated_at=now()',[req.user.id,theme]);res.json({theme});}catch(error){next(error);}});
app.put('/language',required,async(req,res,next)=>{try{const language=req.body.language;if(!['pt-BR','en'].includes(language))return fail(res,400,'JL001','Idioma inválido.');await db.query('insert into settings(user_id,language) values($1,$2) on conflict(user_id) do update set language=excluded.language,updated_at=now()',[req.user.id,language]);res.json({language});}catch(error){next(error);}});
app.get('/notifications', required, async (req, res, next) => { try { res.json({ items: (await db.query('select * from notifications where user_id=$1 order by created_at desc', [req.user.id])).rows }); } catch (error) { next(error); } });
app.post('/support', required, async (req, res, next) => { try { if (!req.body.subject || !req.body.message) return fail(res, 400, 'JL001', 'Informe assunto e mensagem.'); const ticket = await db.query('insert into support_tickets(user_id,subject,message) values($1,$2,$3) returning id,status,created_at', [req.user.id, req.body.subject, req.body.message]); await history(req.user.id, 'suporte', req.body.subject); res.status(201).json({ ticket: ticket.rows[0] }); } catch (error) { next(error); } });
app.post('/support/chat', optional, async (req, res, next) => {
  try {
    const question = String(req.body.message || '').trim(); if (!question) return fail(res, 400, 'JL001', 'Escreva uma pergunta para o suporte.');
    const visitorId = String(req.body.visitorId || '').slice(0,100);
    let conversationId = Number(req.body.conversationId) || 0;
    if (!conversationId) conversationId = (await db.query('insert into support_conversations(user_id,visitor_id) values($1,$2) returning id', [req.user?.id || null, visitorId || null])).rows[0].id;
    await db.query('insert into support_messages(conversation_id,role,content) values($1,$2,$3)', [conversationId,'user',question]);
    const result = answerSupport(question);
    const answer = result?.answer || 'Não encontrei uma resposta para essa dúvida na documentação oficial do JL Registry. Deseja entrar em contato com o suporte humano?';
    await db.query('insert into support_messages(conversation_id,role,content) values($1,$2,$3)', [conversationId,'assistant',answer]);
    await db.query('update support_conversations set updated_at=now() where id=$1',[conversationId]);
    res.json({ conversationId, answered:Boolean(result), answer, source:result?.source || null, canContact:!result });
  } catch (error) { next(error); }
});
app.get('/support/history', optional, async (req,res,next)=>{ try { const visitorId=String(req.query.visitorId||'').slice(0,100); const convo=await db.query('select id from support_conversations where ($1::bigint is not null and user_id=$1) or ($1::bigint is null and visitor_id=$2) order by updated_at desc limit 1',[req.user?.id||null,visitorId||null]); if(!convo.rowCount)return res.json({conversationId:null,items:[]}); const items=await db.query('select role,content,created_at from support_messages where conversation_id=$1 order by created_at',[convo.rows[0].id]);res.json({conversationId:convo.rows[0].id,items:items.rows}); }catch(error){next(error);} });
app.post('/support/feedback', optional, async (req,res,next)=>{ try { const text=String(req.body.message||'').trim(); if(!text)return fail(res,400,'JL001','Escreva o feedback.'); await db.query('insert into support_tickets(user_id,subject,message,status) values($1,$2,$3,$4)',[req.user?.id||null,'Feedback do suporte',text,'feedback']);res.status(201).json({ok:true}); }catch(error){next(error);} });
app.post('/support/contact', optional, async (req,res,next)=>{ try { const question=String(req.body.question||'').trim(); if(!question)return fail(res,400,'JL001','Informe a dúvida para encaminhamento.'); const profile=req.user ? (await db.query('select name,email from users where id=$1',[req.user.id])).rows[0] : null; await db.query('insert into support_tickets(user_id,subject,message,status) values($1,$2,$3,$4)',[req.user?.id||null,'Encaminhamento humano',question,'encaminhado']); const number=String(process.env.SUPPORT_WHATSAPP||'').replace(/\D/g,''); const body=encodeURIComponent(`JL Registry - suporte humano\nUsuário: ${profile?.name||'Visitante'}\nE-mail: ${profile?.email||'não informado'}\nHorário: ${new Date().toISOString()}\nDúvida: ${question}`); if(!number)return res.status(202).json({ok:true,message:'Solicitação registrada. O administrador ainda não configurou o WhatsApp de suporte.'}); res.status(202).json({ok:true,contactUrl:`https://wa.me/${number}?text=${body}`,message:'Solicitação registrada. Abra o WhatsApp para enviar a mensagem ao suporte.'}); }catch(error){next(error);} });
app.get('/support/config', required, adminOnly, async (req,res,next)=>{try{const values=(await db.query("select key,value from registry_settings where key in ('support_email','support_initial_message','support_hours')")).rows;res.json({items:Object.fromEntries(values.map(x=>[x.key,x.value]))});}catch(error){next(error);}});
app.put('/support/config', required, adminOnly, async (req,res,next)=>{try{for(const [key,value] of Object.entries(req.body||{})){if(['support_email','support_initial_message','support_hours'].includes(key))await db.query('insert into registry_settings(key,value,updated_at) values($1,$2,now()) on conflict(key) do update set value=excluded.value,updated_at=now()',[key,String(value)]);}res.json({ok:true});}catch(error){next(error);}});
// Endpoints consumidos pela CLI: arquivos locais nunca são acessados pelo servidor.
app.post('/cli/new-folder', required, (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(name)) return fail(res, 400, 'JL001', 'Nome de pacote inválido. Use letras, números, _ ou -.');
  res.status(201).json({ ok: true, name, files: [`${name}/${name}.jls`, `${name}/README.md`, `${name}/LICENSE`, `${name}/.gitignore`], message: 'Estrutura validada. A pasta deve ser criada localmente pela CLI.' });
});
app.post('/cli/compile', required, (req, res) => {
  const { name, source, manifest } = req.body;
  if (!name || !source || !manifest?.version) return fail(res, 400, 'JL002', 'Envie nome, código-fonte e package.json gerado pela CLI.');
  if (!/info\s*\{/.test(source)) return fail(res, 400, 'JL002', 'Bloco info{} não encontrado.');
  if (!/class\s+Pack\s*\{/.test(source)) return fail(res, 400, 'JL004', 'Classe Pack não encontrada.');
  res.json({ ok: true, name, version: manifest.version, artifact: `${name}-${manifest.version}.jlb`, message: 'Estrutura validada. A compilação do bytecode continua sendo executada localmente pela CLI.' });
});
app.post('/cli/update', required, async (req, res, next) => {
  try {
    const { name, version, readme = '', dependencies = [] } = req.body;
    const item = await packageByName(name); if (!item) return fail(res, 404, 'JL005', 'Pacote não existe no Registry. Publique a primeira versão antes de atualizar.');
    const owner = await db.query('select user_id from packages where id=$1', [item.id]); if (String(owner.rows[0].user_id) !== String(req.user.id)) return fail(res, 403, 'JL001', 'Você não é o autor deste pacote.');
    if (!version || version === item.version) return fail(res, 400, 'JL008', 'Informe uma nova versão diferente da última publicada.');
    await db.query('insert into package_versions(package_id,version,readme,license,dependencies) values($1,$2,$3,$4,$5)', [item.id, version, readme, item.license || 'MIT', JSON.stringify(dependencies)]);
    await db.query('update packages set updated_at=now() where id=$1', [item.id]); await history(req.user.id, 'atualização_cli', name, { version }); io.emit('package:updated', { name, version });
    res.json({ ok: true, name, version, message: 'Nova versão registrada no JL Registry.' });
  } catch (error) { if (error.code === '23505') return fail(res, 409, 'JL008', 'Esta versão já foi publicada.'); next(error); }
});
app.get('/cli/install/:name', async (req, res, next) => { try { const item = await packageByName(req.params.name); if (!item) return fail(res, 404, 'JL005', 'Pacote não encontrado.'); await db.query('update packages set downloads=downloads+1 where id=$1', [item.id]); await db.query('insert into downloads(package_id) values($1)', [item.id]); io.emit('package:download', { name: item.name, downloads: Number(item.downloads) + 1 }); res.json({ ok: true, package: { name:item.name, version:item.version, author:item.author, dependencies:item.dependencies, readme:item.readme }, message: 'Metadados entregues. O download do arquivo requer storage de artefatos configurado no servidor.' }); } catch (error) { next(error); } });
app.get('/cli/search', async (req, res, next) => { try { const q = `%${req.query.q || ''}%`; const rows = await db.query(`select p.name,p.description,p.downloads,u.username author,c.name category,v.version from packages p join users u on u.id=p.user_id left join categories c on c.id=p.category_id left join lateral (select version from package_versions where package_id=p.id order by created_at desc limit 1) v on true where p.name ilike $1 or p.description ilike $1 order by p.downloads desc limit 20`, [q]); res.json({ items: rows.rows }); } catch (error) { next(error); } });
app.get('/cli/packages/:name/version', async (req, res, next) => { try { const item = await packageByName(req.params.name); if (!item) return fail(res, 404, 'JL005', 'Pacote não encontrado.'); res.json({ name:item.name, version:item.version, updatedAt:item.updated_at }); } catch (error) { next(error); } });
io.on('connection', socket => socket.emit('registry:ready', { message: 'Conectado ao JL Registry' }));
app.use((error, _, res, __) => { console.error(error); fail(res, error.status || 500, 'JL010', error.message || 'Erro interno do servidor.'); });
async function start() {
  try {
    const file = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'schema.sql');
    await db.query(await fs.readFile(file, 'utf8'));
    databaseReady = true;
  } catch (error) {
    console.error('Banco de dados indisponível:', error.code || error.message);
  }
  server.listen(process.env.PORT || 3333, () => console.log('JL Registry API ativa'));
}
start();
