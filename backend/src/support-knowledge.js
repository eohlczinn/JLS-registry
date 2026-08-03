import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'support');
const allowed = ['login','cadastro','google','public','biblioteca','pacote','atualiz','instal','download','terminal','jls','api','conta','perfil','hist','configura','erro','jl00','documenta'];
const words = text => text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').match(/[a-z0-9]{3,}/g) || [];
function collect(dir) { return fs.readdirSync(dir,{withFileTypes:true}).flatMap(item => item.isDirectory() ? collect(path.join(dir,item.name)) : item.name.endsWith('.md') ? [path.join(dir,item.name)] : []); }
export function answerSupport(question) {
  const query = words(question);
  if (!query.some(word => allowed.some(prefix => word.startsWith(prefix) || prefix.startsWith(word)))) return null;
  const documents = collect(root).map(file => ({ file, text: fs.readFileSync(file,'utf8') }));
  const ranked = documents.map(document => ({...document, score: query.reduce((total,word)=> total + words(document.text).filter(token=>token===word || token.startsWith(word) || word.startsWith(token)).length,0)})).sort((a,b)=>b.score-a.score);
  if (!ranked[0] || ranked[0].score === 0) return null;
  const lines = ranked[0].text.split(/\r?\n/).filter(line=>line.trim() && !line.startsWith('#'));
  return { answer: lines.slice(0,6).join('\n').trim(), source: path.relative(root, ranked[0].file) };
}
