import assert from 'node:assert/strict';
import {renderArtwork,templates,W,H} from '../src/painter.js';
let serial=0;
function mockCanvas(){
 const calls=[];
 const canvas={id:`canvas-${++serial}`,width:0,height:0,calls};
 const ctx=new Proxy({measureText:text=>({width:text.length*12}),createLinearGradient:()=>({addColorStop(){}})},{get(target,key){if(key in target)return target[key];return (...args)=>calls.push([key,...args]);},set(target,key,value){target[key]=value;return true;}});
 canvas.getContext=()=>ctx;
 canvas.ownerDocument={createElement:()=>mockCanvas()};
 return canvas;
}
const image=id=>({id,width:800,height:900});
const primary=image('primary'),extras={a:image('a'),b:image('b'),c:image('c'),d:image('d')};
const settings={template:'polaroid',title:'豆米和豆糕的日常',stickers:[],strokes:[]};
let count=0;
const test=(name,run)=>{run();count++;console.log(`PASS ${name}`);};
for(const t of templates)test(`${t.name}输出2倍逻辑尺寸`,()=>{const c=mockCanvas();renderArtwork(c,primary,{...settings,template:t.id});assert.equal(c.width,W*2);assert.equal(c.height,H*2);});
test('四格逐槽使用独立照片',()=>{const c=mockCanvas();renderArtwork(c,primary,{...settings,template:'comic',photoSlots:['a','b','c','d']},null,extras);assert.deepEqual(c.calls.filter(x=>x[0]==='drawImage').map(x=>x[1].id),['a','b','c','d']);});
test('曝光使用真正副图',()=>{const c=mockCanvas();renderArtwork(c,primary,{...settings,template:'exposure',secondaryId:'b'},null,extras);assert.ok(c.calls.some(x=>x[0]==='drawImage'&&x[1].id==='b'));});
test('选框仅在编辑预览出现',()=>{const s={...settings,stickers:[{id:'s',type:'heart',x:50,y:70,scale:1,rotation:0}]};const preview=mockCanvas(),exported=mockCanvas();renderArtwork(preview,primary,s,'s');renderArtwork(exported,primary,s,null);assert.equal(preview.calls.filter(x=>x[0]==='strokeRect').length,1);assert.equal(exported.calls.filter(x=>x[0]==='strokeRect').length,0);});
test('第161至200笔仍参与绘制',()=>{const c=mockCanvas(),empty=mockCanvas();renderArtwork(empty,primary,settings);const strokes=Array.from({length:200},(_,i)=>({tool:'marker',color:'#ce8ba7',width:5,points:[{x:50,y:50+i},{x:60,y:55+i}]}));renderArtwork(c,primary,{...settings,strokes});assert.equal(c.calls.filter(x=>x[0]==='stroke').length-empty.calls.filter(x=>x[0]==='stroke').length,200);});
test('马赛克从独立照片快照取样',()=>{const c=mockCanvas();renderArtwork(c,primary,{...settings,strokes:[{tool:'mosaic',width:25,points:[{x:100,y:100},{x:150,y:110}]}]});const samples=c.calls.filter(x=>x[0]==='drawImage'&&x.length===10);assert.ok(samples.length>0);assert.ok(samples.every(x=>x[1]!==c&&x[1]!==primary&&x[1].getContext));assert.equal(new Set(samples.map(x=>x[1].id)).size,1);});
test('无有效主图时明确拒绝绘制',()=>assert.throws(()=>renderArtwork(mockCanvas(),{width:0,height:0},settings),/照片还未准备好/));
test('损坏模板与笔画参数安全回退',()=>{const c=mockCanvas();renderArtwork(c,primary,{template:'bad',brightness:Infinity,stickers:null,strokes:[null,{tool:'unknown',points:[]}],photoSlots:{}});assert.equal(c.width,900);});
console.log(`\n${count} painter command-contract checks passed. These do not verify actual pixels or browser Canvas support.`);
