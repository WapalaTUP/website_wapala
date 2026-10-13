import fs from 'node:fs/promises';
import path from 'node:path';
const url='https://www.wapalatelkomuniversity.org/profil';
const response=await fetch(url);if(!response.ok)throw new Error('Profil: HTTP '+response.status);
const html=await response.text();
const sections=[...html.matchAll(/<div class="angkatan-card">([\s\S]*?)<\/h5>([\s\S]*?)<\/p>/g)];
const clean=s=>s.replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').trim();
const rows=sections.map(m=>{const block=m[1];return {number:clean(block.match(/class="angkatan-no">([\s\S]*?)<\/span>/)?.[1]||''),name:clean(block.match(/<h5[^>]*>([\s\S]*)$/)?.[1]||''),label:clean(m[2]),source:block.match(/<img\s+src="([^"]+)"/)?.[1]};});
if(rows.length!==21||rows.some(r=>!r.name||!r.source))throw new Error('Validasi daftar angkatan gagal: '+rows.length);
const destination=path.resolve('public/images/generations');await fs.mkdir(destination,{recursive:true});
for(let start=0;start<rows.length;start+=4){await Promise.all(rows.slice(start,start+4).map(async row=>{const res=await fetch(row.source);if(!res.ok)throw new Error(row.name+': HTTP '+res.status);const bytes=Buffer.from(await res.arrayBuffer());await fs.writeFile(path.join(destination,row.number+'.png'),bytes);row.image='/images/generations/'+row.number+'.png';row.bytes=bytes.length;}));}
process.stdout.write(JSON.stringify({source:url,generations:rows},null,2));
