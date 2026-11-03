// Offline specimen: real WXML/WXSS + native renderer, isolated sample data only.
// Chromium is used as a layout/pixel checker, not as a WeChat runtime substitute.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { parseFragment } from 'parse5';
const root=path.resolve(import.meta.dirname,'..'),native=path.join(root,'miniprogram');
const out=path.join(root,'output/playwright/studio-20261030');fs.mkdirSync(out,{recursive:true});
const require=createRequire(import.meta.url);let def,menu;
globalThis.Page=o=>{def=o;};globalThis.Component=o=>{menu=o;};
require('../miniprogram/pages/studio/index.js');require('../miniprogram/components/bunny-menu/index.js');
const model=require('../miniprogram/utils/studio-model.js');
const state=require('../miniprogram/utils/store.js').initial();
const photos=state.photos.slice(0,6);
const clone=x=>JSON.parse(JSON.stringify(x));
const esc=x=>String(x??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const evaluate=(expression,scope)=>new Function('s','with(s){return ('+expression+');}')(new Proxy(scope,{has:()=>true,get:(target,key)=>key===Symbol.unscopables?undefined:target[key]}));
const bind=(value,scope)=>String(value??'').replace(/\{\{([\s\S]*?)\}\}/g,(_,expression)=>evaluate(expression,scope)??'');
function asset(src){
 if(!src||!src.startsWith('/assets/'))return src;
 return 'data:image/'+(src.endsWith('.svg')?'svg+xml':'jpeg')+';base64,'+fs.readFileSync(path.join(native,src.slice(1))).toString('base64');
}
const tree=source=>parseFragment(source.replace(/<image\b/g,'<img').replace(/<([\w-]+)([^<>]*?)\s*\/>/g,'<$1$2></$1>'));
const studioTree=tree(fs.readFileSync(path.join(native,'pages/studio/index.wxml'),'utf8'));
const menuTree=tree(fs.readFileSync(path.join(native,'components/bunny-menu/index.wxml'),'utf8'));
function nodes(items,scope){
 let matched=false,chain=false;
 return (items||[]).map(node=>{
  if(node.nodeName==='#text')return esc(bind(node.value,scope));if(node.nodeName==='#comment')return '';
  const attrs=Object.fromEntries((node.attrs||[]).map(a=>[a.name,a.value]));
  if(attrs['wx:if']){chain=true;matched=!!evaluate(attrs['wx:if'].slice(2,-2),scope);if(!matched)return '';}
  else if(attrs['wx:elif']){if(!chain||matched)return '';matched=!!evaluate(attrs['wx:elif'].slice(2,-2),scope);if(!matched)return '';}
  else if(Object.hasOwn(attrs,'wx:else')){if(!chain||matched)return '';matched=true;}
  else{chain=false;matched=false;}
  if(attrs['wx:for']){const rows=evaluate(attrs['wx:for'].slice(2,-2),scope)||[];return rows.map((item,index)=>element(node,attrs,{...scope,[attrs['wx:for-item']||'item']:item,[attrs['wx:for-index']||'index']:index})).join('');}
  return element(node,attrs,scope);
 }).join('');
}
function element(node,attrs,scope){
 const name=node.tagName;
 if(name==='block')return nodes(node.childNodes,scope);
 if(name==='page-top')return '<div class="spec-header"><span>♧ 兔兔小窝 ♡</span><button>翻开目录 ✧</button></div>';
 if(name==='bunny-menu')return '';
 if(name==='page-heading')return '<div class="spec-heading"><small>'+esc(bind(attrs.eyebrow,scope))+'</small><h1>'+esc(bind(attrs.title,scope))+'</h1><p>'+esc(bind(attrs.description,scope))+'</p></div>';
 if(name==='empty-state')return '<p class="tiny">'+esc(bind(attrs.text,scope))+'</p>';
 const tag=({view:'div','scroll-view':'div',text:'span',picker:'div',slider:'input'})[name]||name;
 const output=[];
 for(const [key,raw] of Object.entries(attrs)){
  if(key.startsWith('wx:')||/^(bind|catch)/.test(key)||['mode','scroll-x','scroll-y','range','block-size','activecolor','backgroundcolor'].includes(key))continue;
  const value=bind(raw,scope);
  if(['disabled','hidden'].includes(key)){if(value==='true')output.push(key);continue;}
  if(key==='aria-role'){output.push('role="'+esc(value)+'"');continue;}
  if(key==='src'){output.push('src="'+asset(value)+'"');continue;}
  output.push(key+'="'+esc(value)+'"');
 }
 if(name==='slider')output.push('type="range"');
 return '<'+tag+' '+output.join(' ')+'>'+nodes(node.childNodes,scope)+'</'+tag+'>';
}
const cssFiles=['styles/tokens.wxss','styles/base.wxss','styles/components.wxss','styles/responsive.wxss','components/bunny-menu/index.wxss','pages/studio/index.wxss'];
let css=cssFiles.map(f=>fs.readFileSync(path.join(native,f),'utf8')).join('\n').replace(/@import[^;]+;/g,'');
css=css.replace(/\bpage(?=\s*[{:])/g,'body').replace(/\bview\b/g,'div').replace(/\btext(?=[\s:.>#\[+~,{])/g,'span').replace(/\bimage\b/g,'img').replace(/([\d.]+)rpx/g,'calc($1 * 100vw / 750)');
const extra='*{box-sizing:border-box}body{margin:0}button,input,textarea{font:inherit;color:inherit}button{cursor:pointer}img{object-fit:cover}button:disabled{cursor:default}button::after{border:0}.spec-header{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:24px 15px 10px;font-size:14px}.spec-header button{font-size:12px;border:1px solid #e2d1da;background:#fffdf8;border-radius:10px;padding:9px}.spec-heading{margin-bottom:18px}.spec-heading small{font-size:11px;color:#806c7b}.spec-heading h1{font-size:27px;font-weight:500;font-family:KaiTi,serif;margin:5px 0}.spec-heading p{font-size:12px;margin:4px 0}.photo-rail{overflow-x:auto}.rail-inner{display:flex}.layer-list{overflow-y:auto}.directory-mask{z-index:100}.directory-sheet{overflow-y:auto}.directory-title,.chapter-title,.chapter-caption{display:block}.chapter img{width:100%;height:130px}.page{max-width:1100px;margin:0 auto;padding:15px}.input{max-width:100%}input[type=range]{display:block;width:92%;min-height:44px;padding:0;background:transparent;border:0;accent-color:#ce8ba7}picker{display:block}.template-item,.paper-option,.tone-preset,.brush-chip,.studio-tab{line-height:1.5}.canvas-stage{min-height:320px}@media(min-width:760px){.artboard{height:400px!important}.canvas-stage{min-height:444px}}';
const painterSource=fs.readFileSync(path.join(native,'utils/painter.js'),'utf8');
function sample(patch={}){
 const data=clone(def.data);Object.assign(data,{ready:true,canvasHeight:300,photos:photos.map((p,index)=>({...p,selected:!index})),chosenSrc:photos[0].src,photoTitles:['同图柔和叠影',...photos.map(p=>p.title)],slotTitles:photos.map(p=>p.title)},patch);
 if(!patch.currentTransform)data.currentTransform=data.settings.transform;
 return data;
}
const creative=model.defaults();creative.template='duo';creative.paper='#dcebdc';creative.title='一封软乎乎的来信 ♡';creative.photoSlots=photos.slice(0,2).map(p=>p.id);
creative.slotTransforms=[{...model.defaults().transform,y:0},{...model.defaults().transform,y:50}];
creative.stickers=[{id:'caption',type:'caption',text:'小日子，慢慢珍藏 ♡',x:205,y:391,scale:.72,rotation:-5,fontSize:22,color:'#6b5b73',background:true},{id:'flower',type:'flower',x:375,y:382,scale:.8,rotation:0,color:'#ce8ba7'}];
const active=painterSource; // Embedded as-is; this is the same renderer as the native page.
const fixtures=[
 ['templates-390',390,sample(),false],['templates-320',320,sample(),false],
 ['compose-390',390,sample({tool:'构图',settings:creative,compositionIndex:1,compositionValue:2,compositionTitles:['全部镜头（覆盖独立取景）','单独调整第 1 镜头','单独调整第 2 镜头'],currentTransform:creative.slotTransforms[1],slots:creative.photoSlots.map((id,index)=>({id,index,src:photos[index].src}))}),false],
 ['text-390',390,sample({tool:'文字',settings:creative,currentSticker:creative.stickers[0],selectedId:'caption',layersOpen:true,layers:creative.stickers.map((s,index)=>({...s,index,name:model.layerName(s),selected:s.id==='caption'})).reverse()}),false],
 ['color-320',320,sample({tool:'调色',activeTone:'film',settings:{...model.defaults(),brightness:104,contrast:86,saturation:72},exportOpen:true}),false],
 ['workspace-1024',1024,sample({tool:'贴纸',settings:creative,layers:creative.stickers}),false],
 ['text-1024',1024,sample({tool:'文字',settings:creative,currentSticker:creative.stickers[0],selectedId:'caption',layers:creative.stickers}),false],
 ['templates-760',760,sample(),false],
 ['directory-390',390,sample({canvasMounted:false,ready:false}),true],
 ['empty-390',390,sample({ready:false,photos:[],chosenSrc:'',error:'先去相册带一帧回忆过来吧。'}),false]
];
for(const [name,width,data,directory] of fixtures){
 const settings=data.settings,images=photos.map(p=>({id:p.id,src:asset(p.src)}));
 const renderScript=`const module={exports:{}};const wx={createOffscreenCanvas:({width,height})=>{const c=document.createElement('canvas');c.width=width;c.height=height;return c;}};${active}
 window.ready=(async()=>{const photos=${JSON.stringify(images)},images={};for(const p of photos){const img=new Image();img.src=p.src;await img.decode();images[p.id]=img;}
 const c=document.querySelector('canvas');if(c){module.exports.renderArtwork(c,images[photos[0].id],${JSON.stringify(settings)},${JSON.stringify(data.selectedId||null)},images);const w=c.getBoundingClientRect().width;c.style.height=(w*500/450)+'px';}
 window.painter=module.exports;window.photoImages=images;return true;})();`;
 const directoryHtml=directory?nodes(menuTree.childNodes,{...clone(menu.data),directory:true,hideDock:true,safeTop:30}):'';
  const html='<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>工坊离线样张 · '+name+'</title><style>'+css+'\n'+extra+'\nbutton{border:0}.button,.png-action{border:1px solid #d8bfcf}'+ '</style>'+nodes(studioTree.childNodes,data)+directoryHtml+'<script>'+renderScript+'</script></html>';
 fs.writeFileSync(path.join(out,name+'.html'),html);
}
if(process.argv.includes('--screenshots')){
 const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE||'D:/java/yuanbao/stark-workbench/node_modules/playwright/index.mjs').href);
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'C:/Users/HUAWEI/AppData/Local/ms-playwright/chromium-1148/chrome-win/chrome.exe'});
 const report=[];
 try{
  for(const [name,width,,directory] of fixtures){
   const page=await browser.newPage({viewport:{width,height:844},reducedMotion:'reduce'});const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(pathToFileURL(path.join(out,name+'.html')).href);await page.evaluate(()=>window.ready);await page.screenshot({path:path.join(out,name+'.png'),fullPage:true});
   const result=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,canvasCount:document.querySelectorAll('canvas').length,buttons:[...document.querySelectorAll('button')].filter(b=>b.offsetWidth&&b.offsetHeight&&b.getBoundingClientRect().width<43).map(b=>b.textContent.trim())}));
   assert.deepEqual(errors,[],name);assert.equal(result.overflow,false,name+' horizontal overflow');if(directory)assert.equal(result.canvasCount,0);
   report.push({name,width,...result});
   if(name==='text-390'){
    const png=await page.locator('canvas').evaluate((c,s)=>{window.painter.renderArtwork(c,window.photoImages[Object.keys(window.photoImages)[0]],s,null,window.photoImages);return c.toDataURL('image/png');},creative);fs.writeFileSync(path.join(out,'双兔来信-实际绘图样张.png'),Buffer.from(png.split(',')[1],'base64'));
    const geometry=await page.evaluate(()=>{
     const c=document.createElement('canvas'),ctx=c.getContext('2d'),img=document.createElement('canvas');img.width=120;img.height=90;img.getContext('2d').fillStyle='#ff0000';img.getContext('2d').fillRect(0,0,120,90);
     const failures=[];
     for(const rotation of [0,90,180,270])for(const flipX of [false,true])for(const flipY of [false,true])for(const x of [-100,100])for(const y of [-100,100]){
      window.painter.renderArtwork(c,img,{template:'polaroid',transform:{zoom:1.7,rotation,flipX,flipY,x,y},stickers:[],strokes:[]});
      for(const [px,py] of [[26,36],[423,36],[26,385],[423,385]]){const p=ctx.getImageData(px*2,py*2,1,1).data;if(p[0]<240||p[1]>10||p[2]>10)failures.push({rotation,flipX,x,y,px,py,p:[...p]});}
     }
     return {cases:64,failures};
    });
    assert.deepEqual(geometry.failures,[],'photo transform must fill every crop corner');report.push({pixelGeometry:geometry});
   }
   await page.close();
  }
 }finally{await browser.close();}
 fs.writeFileSync(path.join(out,'layout-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}
console.log('Offline studio specimens: '+out);
