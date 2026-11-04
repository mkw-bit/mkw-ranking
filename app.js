'use strict';
const $ = id => document.getElementById(id);
const text = x => document.createTextNode(String(x ?? ''));
const elt = (tag,cls='',val) => {const e=document.createElement(tag);e.className=cls;if(val!==undefined)e.append(text(val));return e;};
let data=null;
function parseDate(str) {
  const m=String(str||'').match(/(20\d{2})[-/](\d{1,2})[-/](\d{1,2})/);
  if (!m) return null;
  const d=new Date(Date.UTC(+m[1],+m[2]-1,+m[3]));
  return Number.isNaN(d.valueOf()) || d.getUTCFullYear()!==+m[1] ? null : d;
}
function ending(ev) {
  // Prefer stable machine-readable end date from future exports.
  const explicit=parseDate(ev.end_iso || ev.event_date_end);
  if(explicit) return explicit;
  const start=parseDate(ev.start_iso || ev.event_date_start || ev.date);
  if(!start) return null;
  const s=String(ev.date||'');
  const parts=s.split(/[～〜~]/);
  if(parts.length<2) return start;
  const tail=parts[1].trim();
  const full=parseDate(tail);if(full)return full;
  const md=tail.match(/^(\d{1,2})[-/](\d{1,2})/);
  if(!md)return start;
  let year=start.getUTCFullYear();
  if(+md[1]<start.getUTCMonth()+1)year++;
  return new Date(Date.UTC(year,+md[1]-1,+md[2]));
}
function seasonFor(d){if(!d)return '';const y=d.getUTCFullYear();return y<=2026&&y>=2025?'2025-2026season':`${y}season`;}
function score(v){const m=String(v||'').match(/\/\s*(\d+)\s*pt/i);return m?+m[1]:0;}
function decorate(v){
  v=String(v||'');
  if(/(?:^|[^a-z0-9])(?:SF|QF|[1-9]\d*R)(?=$|[^a-z0-9])|Semifinal|Quarterfinal/i.test(v)||/^A\s*\//i.test(v))return text(v);
  const b=elt('span','badge');if(/^(1st|1位)/i.test(v))b.classList.add('first');else if(/^(2nd|2位)/i.test(v))b.classList.add('second');else if(/^(3rd|3位)/i.test(v))b.classList.add('third');else if(/^([4-9]|1\d|2[0-4])(th|位)/i.test(v))b.classList.add('other');else return text(v);
  b.append(text(v));return b;
}
function activeIndices(){
  const period=$('period').value, mode=$('mode').value;
  const dates=data.events.map(ending);
  const latest=dates.filter(Boolean).reduce((a,b)=>!a||b>a?b:a,null);
  // One shared cutoff, independent of the display-mode filter.
  const cutoff=latest?new Date(latest.getTime()-52*7*86400000):null;
  return data.events.map((ev,i)=>({ev,i,d:dates[i]})).filter(({ev,d})=>
    d && (mode==='all'||ev.mode===mode) &&
    (period==='rolling'?cutoff&&d>cutoff:seasonFor(d)===period));
}
function render(){
  if(!data)return;
  const included=activeIndices();
  const tr=elt('tr');
  [['順位','sticky-rank'],['プレイヤー名','sticky-name'],['獲得Points','num'],['大会数','num']].forEach(([t,c])=>tr.append(elt('th',c,t)));
  included.forEach(({ev})=>{const th=elt('th','',ev.name);th.append(elt('small','',ev.date));tr.append(th);});
  $('thead').replaceChildren(tr);
  const rows=data.players.map(p=>{
    const res=included.map(({i})=>p.results?.[i] ?? 'A / 0pt');
    const points=res.reduce((sum,v)=>sum+score(v),0);
    const count=res.filter(v=>!/^A\s*\//i.test(v)).length;
    return {name:p.name,points,count,res};
  }).filter(p=>p.count>0);
  rows.sort((a,b)=>b.points-a.points||b.count-a.count||a.name.localeCompare(b.name,'ja'));
  let prior=null, rank=0;
  rows.forEach((p,i)=>{if(p.points!==prior)rank=i+1;p.rank=rank;prior=p.points;});
  const query=$('search').value.trim().toLocaleLowerCase();
  const filtered=rows.filter(p=>p.name.toLocaleLowerCase().includes(query));
  if($('sort').value==='name')filtered.sort((a,b)=>a.name.localeCompare(b.name,'ja'));
  if($('sort').value==='participations')filtered.sort((a,b)=>b.count-a.count||a.rank-b.rank);
  const shown=$('limit').value==='all'?filtered:filtered.slice(0,Number($('limit').value));
  const frag=document.createDocumentFragment();
  shown.forEach(p=>{const r=elt('tr');r.append(elt('td','sticky-rank rank',p.rank),elt('td','sticky-name',p.name),elt('td','num points',p.points.toLocaleString('ja-JP')),elt('td','num',p.count));p.res.forEach(v=>{const c=elt('td');c.append(decorate(v));r.append(c);});frag.append(r);});
  $('tbody').replaceChildren(frag);
  $('players-count').textContent=rows.length.toLocaleString('ja-JP');
  $('events-count').textContent=included.length.toLocaleString('ja-JP');
  $('shown').textContent=`${filtered.length.toLocaleString('ja-JP')}名が該当 / ${shown.length.toLocaleString('ja-JP')}名を表示`;
  $('status').textContent=rows.length?'':'対象の大会・選手データがありません。';
  $('period-note').textContent=$('period').value==='rolling'?'52週経過後、次の対象大会が終了した時点で失効します（最後の大会終了日を基準）。':'シーズン内の獲得ポイントをすべて合計します。52週による失効はありません。';
}
async function start(){try{
  const response=await fetch('ranking.json',{cache:'no-store'});if(!response.ok)throw new Error(`HTTP ${response.status}`);
  data=await response.json();if(!Array.isArray(data.events)||!Array.isArray(data.players))throw Error('ranking.jsonの形式が不正');
  const seasons=[...new Set(data.events.map(ending).map(seasonFor).filter(Boolean))].sort();
  for(const season of seasons){if([...$('period').options].some(o=>o.value===season))continue;const opt=elt('option','',season);opt.value=season;$('period').append(opt);}
  $('updated').textContent=data.updated?'データ更新：'+data.updated:'更新日未設定';
  ['period','mode','sort','limit','search'].forEach(id=>$(id).addEventListener(id==='search'?'input':'change',render));
  render();
}catch(e){console.error(e);$('status').textContent='読み込みに失敗しました。ranking.jsonが同じ階層にあるか確認してください。';}}
start();
