'use strict';
const $ = id => document.getElementById(id);
const text = x => document.createTextNode(String(x ?? ''));
const elt = (tag,cls='',val) => {const e=document.createElement(tag);e.className=cls;if(val!==undefined)e.append(text(val));return e;};
let data=null;
let eventSortIndex=null;
let eventSortReverse=false;
function parseDate(str) {
  const m=String(str||'').match(/(20\d{2})[-/](\d{1,2})[-/](\d{1,2})/);
  if (!m) return null;
  const d=new Date(Date.UTC(+m[1],+m[2]-1,+m[3]));
  return Number.isNaN(d.valueOf()) || d.getUTCFullYear()!==+m[1] ? null : d;
}
function beginning(ev) {
  // Prefer the start date; old exports may only contain a human-readable date.
  return parseDate(ev.start_iso || ev.event_date_start || ev.date);
}
function seasonFor(d){if(!d)return '';const y=d.getUTCFullYear();return y<=2026&&y>=2025?'2025-2026season':`${y}season`;}
function score(v){const m=String(v||'').match(/\/\s*(\d+)\s*pt/i);return m?+m[1]:0;}
function resultParts(v){
  const raw=String(v||'');
  const label=raw.split('/')[0].trim();
  const place=label.match(/^(\d+)(?:st|nd|rd|th|位)(?:\s*[-–]\s*(\d+)(?:st|nd|rd|th|位))?/i);
  const stage=(label.match(/\((SF|QF|[1-9]R|Finalist|Semifinalists)\)/i)||[])[1]||'';
  return {label,place:place?+place[1]:null,stage:stage.toUpperCase(),absent:/^A\s*\//i.test(raw),unconfirmed:/unconfirmed/i.test(raw)};
}
function resultSortValue(v){
  const p=resultParts(resultText(v));
  if(p.absent)return 1000000;
  if(p.place!==null)return p.place;
  const stageRanks={FINALIST:25,SF:100,QF:200,'4R':300,'3R':400,'2R':500,'1R':600,R:650};
  return stageRanks[p.stage]??900000;
}
function resultText(value){
  return value && typeof value==='object' ? String(value.result ?? value.label ?? value.text ?? '') : String(value??'');
}
function teamFor(player,event,index,value){
  if(event.mode!=='6v6')return '';
  if(value && typeof value==='object' && value.team)return String(value.team).trim();
  const teams=player.teams ?? player.team_names ?? player.teamNames;
  if(Array.isArray(teams))return String(teams[index]??'').trim();
  if(teams && typeof teams==='object')return String(teams[event.id]??teams[event.name]??teams[index]??'').trim();
  return '';
}
function decorateResult(value,team){
  const raw=resultText(value);
  const item=decorate(raw);
  if(!team || /^A\s*\//i.test(raw))return item;
  const result=elt('span','team-result');
  const split=raw.match(/^(.*?)\s*\/\s*(\d+\s*pt)\s*$/i);
  if(split){
    const prefix=split[1].trim();
    const prefixEl=decorate(prefix);
    result.append(prefixEl,text(' / '));
    result.append(elt('span','team-name',team),text(' / '+split[2]));
  }else{
    result.append(item,text(' / '));result.append(elt('span','team-name',team));
  }
  return result;
}
function decorate(v){
  v=String(v||'');
  const p=resultParts(resultText(v));
  if(p.absent || p.stage==='SF' || p.stage==='QF' || /^[1-9]R$/.test(p.stage) || p.stage==='SEMIFINALISTS')return text(v);
  let cls='';
  if(p.stage==='FINALIST')cls='other';
  else if(p.place===1)cls='first';
  else if(p.place===2)cls='second';
  else if(p.place===3)cls='third';
  else if(p.place!==null && p.place>=4 && p.place<=24 && score(v)>=600)cls='other';
  if(!cls)return text(v);
  const b=elt('span','badge '+cls,v);return b;
}
const finalFFA=[1800,1200,1080,800,800,800,720,720,720,720,720,720,540,540,540,540,540,540,540,540,540,540,540,540];
const teamSizes={FFA:1,'2v2':2,'3v3':3,'4v4':4,'6v6':6};
function renderPoints(){
  const mode=$('points-mode').value, size=teamSizes[mode]||1;
  const table=elt('table','points-grid');
  const head=elt('thead'), hr=elt('tr');
  ['決勝順位','Points'].forEach(t=>hr.append(elt('th','',t)));head.append(hr);table.append(head);
  const body=elt('tbody');
  for(let i=0;i<24;i+=size){
    const tr=elt('tr');tr.append(elt('td','',`${i/size+1}位`));
    tr.append(elt('td','num',finalFFA.slice(i,i+size).reduce((a,b)=>a+b,0)/size));body.append(tr);
  }
  table.append(body);$('points-table').replaceChildren(table);
}
function activeIndices(){
  const period=$('period').value, mode=$('mode').value;
  const dates=data.events.map(beginning);
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
  [['順位','sticky-rank'],['プレイヤー名','sticky-name'],['Points','num'],['大会数','num']].forEach(([t,c])=>tr.append(elt('th',c,t)));
  included.forEach(({ev,i})=>{
    const th=elt('th','event-heading');const btn=elt('button','event-sort',ev.name);
    btn.type='button';btn.title='この大会の順位で並び替え';
    btn.append(elt('span','sort-arrow',eventSortIndex===i?(eventSortReverse?' ▼':' ▲'):' ↕'));
    btn.addEventListener('click',()=>{
      if(eventSortIndex===i)eventSortReverse=!eventSortReverse;
      else {eventSortIndex=i;eventSortReverse=false;}
      render();
    });
    th.append(btn,elt('small','',ev.date));tr.append(th);
  });
  $('thead').replaceChildren(tr);
  const rows=data.players.map(p=>{
    const res=included.map(({i})=>p.results?.[i] ?? 'A / 0pt');
    const teamNames=included.map(({ev,i},col)=>teamFor(p,ev,i,res[col]));
    const points=res.reduce((sum,v)=>sum+score(resultText(v)),0);
    const count=res.filter(v=>!/^A\s*\//i.test(resultText(v))).length;
    return {name:p.name,points,count,res,teamNames};
  }).filter(p=>p.count>0);
  rows.sort((a,b)=>b.points-a.points||b.count-a.count||a.name.localeCompare(b.name,'ja'));
  let prior=null, rank=0;
  rows.forEach((p,i)=>{if(p.points!==prior)rank=i+1;p.rank=rank;prior=p.points;});
  const query=$('search').value.trim().toLocaleLowerCase();
  const filtered=rows.filter(p=>p.name.toLocaleLowerCase().includes(query));
  if(eventSortIndex!==null){
    const column=included.findIndex(({i})=>i===eventSortIndex);
    if(column>=0)filtered.sort((a,b)=>
      (resultSortValue(a.res[column])-resultSortValue(b.res[column]))*(eventSortReverse?-1:1) || a.rank-b.rank);
    else eventSortIndex=null;
  }
  if(eventSortIndex===null && $('sort').value==='name')filtered.sort((a,b)=>a.name.localeCompare(b.name,'ja'));
  if(eventSortIndex===null && $('sort').value==='participations')filtered.sort((a,b)=>b.count-a.count||a.rank-b.rank);
  const shown=$('limit').value==='all'?filtered:filtered.slice(0,Number($('limit').value));
  const frag=document.createDocumentFragment();
  shown.forEach(p=>{const r=elt('tr');r.append(elt('td','sticky-rank rank',p.rank),elt('td','sticky-name',p.name),elt('td','num points',p.points.toLocaleString('ja-JP')),elt('td','num',p.count));p.res.forEach((v,i)=>{const c=elt('td');c.append(decorateResult(v,p.teamNames[i]));r.append(c);});frag.append(r);});
  $('tbody').replaceChildren(frag);
  $('players-count').textContent=rows.length.toLocaleString('ja-JP');
  $('events-count').textContent=included.length.toLocaleString('ja-JP');
  $('shown').textContent=`${filtered.length.toLocaleString('ja-JP')}名が該当 / ${shown.length.toLocaleString('ja-JP')}名を表示`;
  $('status').textContent=rows.length?'':'対象の大会・選手データがありません。';
  $('period-note').textContent=$('period').value==='rolling'?'最後に登録された対象大会の開始日を基準に直近52週を集計します。次の対象大会が登録されたときに期限切れポイントが失効します。':'シーズン内の獲得ポイントをすべて合計します。52週による失効はありません。';
}
async function start(){try{
  const response=await fetch('ranking.json',{cache:'no-store'});if(!response.ok)throw new Error(`HTTP ${response.status}`);
  data=await response.json();if(!Array.isArray(data.events)||!Array.isArray(data.players))throw Error('ranking.jsonの形式が不正');
  const seasons=[...new Set(data.events.map(beginning).map(seasonFor).filter(Boolean))].sort();
  for(const season of seasons){if([...$('period').options].some(o=>o.value===season))continue;const opt=elt('option','',season);opt.value=season;$('period').append(opt);}
  $('updated').textContent=data.updated?'データ更新：'+data.updated:'更新日未設定';
  ['period','mode','sort','limit','search'].forEach(id=>$(id).addEventListener(id==='search'?'input':'change',()=>{if(id==='sort'||id==='mode'||id==='period')eventSortIndex=null;render();}));
  render();
}catch(e){console.error(e);$('status').textContent='読み込みに失敗しました。ranking.jsonが同じ階層にあるか確認してください。';}}
$('points-mode').addEventListener('change',renderPoints);
renderPoints();
start();
