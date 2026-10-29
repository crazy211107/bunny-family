const store=require('../../utils/store');
const painter=require('../../utils/painter');
const defaults=()=>({template:'polaroid',title:'今天也要贴在一起 ♡',font:painter.fontOptions[0].value,brightness:100,contrast:100,saturation:100,stickers:[],strokes:[],photoSlots:[],secondaryId:''});
const whenText=value=>{const d=new Date(value);if(isNaN(d.getTime()))return '刚刚';const pad=n=>String(n).padStart(2,'0');return `${pad(d.getMonth()+1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;};
Page({
 data:{photos:[],photoTitles:[],slotTitles:[],chosenSrc:'',templateName:painter.templates[0].name,templates:painter.templates,fonts:painter.fontOptions.map(f=>f.name),tools:['模板','贴纸','涂鸦','文字','调色'],tool:'模板',settings:defaults(),ready:false,error:'',canUndo:false,canRedo:false,steps:0,selectedId:'',currentSticker:null,brush:'marker',brushWidth:8,color:'#ce8ba7',brushes:[{id:'marker',title:'马克笔'},{id:'highlight',title:'荧光笔'},{id:'dash',title:'虚线笔'},{id:'mosaic',title:'马赛克'}],colorNames:['樱花粉','薄荷绿','奶油黄','可可紫','奶油白'],colors:['#ce8ba7','#a8c6aa','#e8c46d','#6b5b73','#fff9f0'],slots:[],drafts:[],busy:false},
 onLoad(options){this.settings=defaults();this.past=[];this.future=[];this.images={};this.currentId=options.id||'';this.loadState();},
 onReady(){wx.createSelectorQuery().in(this).select('#artboard').fields({node:true,size:true,rect:true}).exec(result=>{if(!result[0]||!result[0].node){this.setData({error:'Canvas 未就绪，请重新进入工坊。'});return;}this.canvas=result[0].node;this.canvasBox=result[0];this.loadImages();});},
 onShow(){if(this.settings){this.loadState();if(this.canvas){this.loadImages();}}},
 onResize(){if(!this.canvas)return;this.finishGesture();wx.createSelectorQuery().in(this).select('#artboard').fields({size:true,rect:true}).exec(result=>{if(result[0]&&result[0].width)this.canvasBox=result[0];});},
 onUnload(){this.loadToken=(this.loadToken||0)+1;},
loadState(){const state=store.get(),photos=store.activePhotos(state);if(!photos.some(p=>p.id===this.currentId))this.currentId=photos.length?photos[0].id:'';this.photos=photos;const chosen=photos.find(p=>p.id===this.currentId);this.setData({photos:photos.map(p=>Object.assign({},p,{selected:p.id===this.currentId})),photoTitles:['同图柔和叠影'].concat(photos.map(p=>p.title)),slotTitles:photos.map(p=>p.title),chosenSrc:chosen?chosen.src:'',drafts:(state.editorDrafts||[]).map(d=>Object.assign({},d,{when:whenText(d.updatedAt)}))});this.sync();},
sync(){const selected=this.settings.stickers.find(s=>s.id===this.data.selectedId)||null;const slotSource=Array.isArray(this.settings.photoSlots)?this.settings.photoSlots:[];const slots=[0,1,2,3].map(index=>{const id=slotSource[index]||this.currentId;const photo=this.photos&&this.photos.find(p=>p.id===id);return {index,id,src:photo?photo.src:'',photoIndex:Math.max(0,(this.photos||[]).findIndex(p=>p.id===id))};});const meta=painter.templates.find(t=>t.id===this.settings.template)||painter.templates[0];this.setData({settings:store.clone(this.settings),templateName:meta.name,canUndo:!!this.past.length,canRedo:!!this.future.length,steps:this.past.length,currentSticker:selected,slots,fontIndex:Math.max(0,painter.fontOptions.findIndex(f=>f.value===this.settings.font)),secondaryIndex:Math.max(0,(this.photos||[]).findIndex(p=>p.id===this.settings.secondaryId)+1)});if(this.canvas&&this.data.ready)this.draw();},
 async sourceCandidates(src){
  if(!src)throw new Error('照片地址为空');
  if(/^https?:/i.test(src)||src.indexOf('wxfile:')===0||src.indexOf('data:')===0)return [src];
  const fix=value=>{if(!value)return value;if(value.charAt(0)==='/'||/^[a-z]+:\/\//i.test(value)||value.indexOf('data:')===0)return value;return '/'+value;};
  const list=[];
  try{
    const info=await new Promise((resolve,reject)=>wx.getImageInfo({src,success:resolve,fail:reject}));
    if(info&&info.path){list.push(fix(info.path));}
  }catch(error){}
  list.push(fix(src));
  return list.filter((item,index)=>item&&list.indexOf(item)===index);
},
copyToLocal(src){
  const fix=value=>{if(!value)return value;if(value.charAt(0)==='/'||/^[a-z]+:\/\//i.test(value)||value.indexOf('data:')===0)return value;return '/'+value;};
  try{
    const fs=wx.getFileSystemManager();
    const target=`${wx.env.USER_DATA_PATH}/studio-${src.replace(/[^a-zA-Z0-9.]+/g,'_')}`;
    try{fs.accessSync(target);return target;}catch(error){}
    fs.writeFileSync(target,fs.readFileSync(fix(src),'binary'),'binary');
    
    return target;
  }catch(error){return '';}
},
async loadCanvasImage(src){
  const img=this.canvas.createImage();
  await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('加载超时 '+src)),5000);
    img.onload=()=>{clearTimeout(timer);resolve();};
    img.onerror=()=>{clearTimeout(timer);reject(new Error('解码失败 '+src));};
    img.src=src;
  });
  return img;
},
async image(id){
  const photo=(this.photos||[]).find(p=>p.id===id);
  if(!photo)throw new Error('照片已收起或不存在');
  if(this.images[id])return this.images[id];
  if(!this.canvas)throw new Error('画布还没准备好');
  const candidates=await this.sourceCandidates(photo.src);
  let lastError=null;
  for(let i=0;i<candidates.length;i++){
    try{
      const img=await this.loadCanvasImage(candidates[i]);
      
      this.images[id]=img;
      return img;
    }catch(error){lastError=error;}
  }
  const local=this.copyToLocal(photo.src);
  if(local){
    try{
      const img=await this.loadCanvasImage(local);
      
      this.images[id]=img;
      return img;
    }catch(error){lastError=error;}
  }
  throw lastError||new Error('图片解码失败');
},
async loadImages(){if(!this.canvas||!this.currentId){this.setData({ready:false,error:'先去相册带一帧回忆过来吧。'});return;}const token=(this.loadToken||0)+1;this.loadToken=token;this.setData({ready:false,error:''});try{const ids=[this.currentId];if(this.settings.template==='comic')ids.push.apply(ids,(this.settings.photoSlots||[]).filter(Boolean));if(this.settings.template==='exposure'&&this.settings.secondaryId)ids.push(this.settings.secondaryId);await Promise.all(Array.from(new Set(ids)).map(id=>this.image(id)));if(token!==this.loadToken)return;this.setData({ready:true});this.draw();}catch(error){if(token===this.loadToken)this.setData({error:'图片读取失败：'+(error.message||'未知原因'),ready:false});}},
 draw(selected){try{painter.renderArtwork(this.canvas,this.images[this.currentId],this.settings,selected===false?null:this.data.selectedId,this.images);this.verifyPaint();}catch(error){this.setData({error:error.message||'作品绘制失败'});}},
 remember(base){this.past.push(store.clone(base||this.settings));if(this.past.length>30)this.past.shift();this.future=[];},
 edit(key,value,load){this.remember();this.settings[key]=value;this.sync();if(load)this.loadImages();},
 undo(){if(!this.past.length)return;this.future.unshift(store.clone(this.settings));this.settings=this.past.pop();this.setData({selectedId:''});this.sync();this.loadImages();},
 redo(){if(!this.future.length)return;this.past.push(store.clone(this.settings));this.settings=this.future.shift();this.setData({selectedId:''});this.sync();this.loadImages();},
 choosePhoto(e){this.currentId=e.currentTarget.dataset.id;this.loadState();this.loadImages();},
 async upload(){try{const photos=await store.choosePhotos(9);if(photos.length){this.currentId=photos[0].id;this.loadState();this.loadImages();}}catch(error){store.toast('图片未能带回家');}},
 chooseTemplate(e){this.edit('template',e.currentTarget.dataset.id,true);},
 tool(e){this.finishGesture();this.setData({tool:e.currentTarget.dataset.tool});},
 inputTitle(e){if(!this.titleBase)this.titleBase=store.clone(this.settings);this.settings.title=e.detail.value;this.draw();},
 titleEnd(){if(this.titleBase&&JSON.stringify(this.titleBase)!==JSON.stringify(this.settings))this.remember(this.titleBase);this.titleBase=null;this.sync();},
 font(e){this.edit('font',painter.fontOptions[Number(e.detail.value)].value);},
 adjust(e){this.edit(e.currentTarget.dataset.key,Number(e.detail.value));},
 cream(){this.remember();Object.assign(this.settings,{brightness:108,contrast:94,saturation:88});this.sync();},
 sticker(e){if(this.settings.stickers.length>=16){store.toast('最多放 16 张贴纸');return;}this.remember();const s={id:store.uid(),type:e.currentTarget.dataset.type,x:225,y:140,scale:1,rotation:0};this.settings.stickers.push(s);this.setData({selectedId:s.id,tool:'贴纸'});this.sync();},
 stickerAdjust(e){const s=this.settings.stickers.find(t=>t.id===this.data.selectedId);if(!s)return;this.remember();s[e.currentTarget.dataset.key]=Number(e.detail.value);this.sync();},
 removeSticker(){this.edit('stickers',this.settings.stickers.filter(s=>s.id!==this.data.selectedId));this.setData({selectedId:''});this.sync();},
 brush(e){this.setData({brush:e.currentTarget.dataset.id});},color(e){this.setData({color:e.currentTarget.dataset.color});},brushWidth(e){this.setData({brushWidth:Number(e.detail.value)});},
 point(e){const touch=e.touches&&e.touches[0]||e.changedTouches&&e.changedTouches[0];if(!touch)return null;const scale=450/this.canvasBox.width;return {x:Math.max(0,Math.min(450,touch.x*scale)),y:Math.max(0,Math.min(500,touch.y*scale))};},
 touchStart(e){if(!this.data.ready)return;const point=this.point(e);if(!point)return;this.gestureBase=store.clone(this.settings);if(this.data.tool==='涂鸦'){if(this.settings.strokes.length>=200){this.gestureBase=null;store.toast('最多画 200 笔，先保存这张作品吧');return;}this.paintId=store.uid();this.settings.strokes.push({id:this.paintId,tool:this.data.brush,width:this.data.brushWidth,color:this.data.color,points:[point]});this.setData({selectedId:''});}else{const selected=this.settings.stickers.slice().reverse().find(s=>Math.abs(s.x-point.x)<42*s.scale&&Math.abs(s.y-point.y)<58*s.scale);this.setData({selectedId:selected?selected.id:''});if(!selected){this.gestureBase=null;this.draw();return;}this.dragId=selected.id;this.offset={x:point.x-selected.x,y:point.y-selected.y};}this.draw();},
 touchMove(e){if(!this.gestureBase)return;const point=this.point(e);if(!point)return;if(this.paintId){const stroke=this.settings.strokes.find(s=>s.id===this.paintId);if(stroke&&stroke.points.length<1000)stroke.points.push(point);}else if(this.dragId){const s=this.settings.stickers.find(t=>t.id===this.dragId);if(s){s.x=Math.max(15,Math.min(435,point.x-this.offset.x));s.y=Math.max(15,Math.min(485,point.y-this.offset.y));}}this.drawThrottled();},
 drawThrottled(){
  const now=Date.now();
  if(now-(this._lastDrawAt||0)<40)return;
  this._lastDrawAt=now;
  this.draw();
},
finishGesture(){
  this._lastDrawAt=0;if(this.gestureBase&&JSON.stringify(this.gestureBase)!==JSON.stringify(this.settings))this.remember(this.gestureBase);this.gestureBase=null;this.paintId=null;this.dragId=null;if(this.settings)this.sync();},
 clearInk(){this.edit('strokes',[]);},
 slot(e){const list=this.settings.photoSlots.slice();while(list.length<4)list.push(this.currentId);list[Number(e.currentTarget.dataset.slot)]=this.photos[Number(e.detail.value)].id;this.edit('photoSlots',list,true);},
 secondary(e){const i=Number(e.detail.value);this.edit('secondaryId',i>0?this.photos[i-1].id:'',true);},
 saveDraft(){this.titleEnd();try{const id=this.draftId||store.uid();const draft={id,name:this.settings.title||'还没写完的可爱',photoId:this.currentId,settings:store.clone(this.settings),updatedAt:new Date().toISOString()};store.update(s=>{s.editorDrafts=[draft].concat(s.editorDrafts.filter(d=>d.id!==id));});this.draftId=id;this.loadState();store.toast('草稿留好啦，下次接着写 ♡');}catch(error){store.toast('草稿未能保存，请检查本机空间');}},
 restore(e){const draft=(store.get().editorDrafts||[]).find(d=>d.id===e.currentTarget.dataset.id);if(!draft)return;if(!this.photos.some(p=>p.id===draft.photoId)){store.toast('请先从相册回收站恢复主照片');return;}this.currentId=draft.photoId;this.draftId=draft.id;this.settings=Object.assign(defaults(),store.clone(draft.settings));this.past=[];this.future=[];this.setData({selectedId:''});this.loadState();this.loadImages();},
 removeDraft(e){try{store.update(s=>{s.editorDrafts=s.editorDrafts.filter(d=>d.id!==e.currentTarget.dataset.id);});this.loadState();}catch(error){store.toast('草稿未能移除');}},
 exportFile(){return new Promise((resolve,reject)=>wx.canvasToTempFilePath({canvas:this.canvas,fileType:'png',destWidth:900,destHeight:1000,success:r=>resolve(r.tempFilePath),fail:reject},this));},
 async saveWork(e){if(!this.data.ready||this.data.busy)return;this.titleEnd();this.finishGesture();this.setData({busy:true,error:''});try{this.draw(false);const temp=await this.exportFile();if(e.currentTarget.dataset.kind==='device'){await new Promise((resolve,reject)=>wx.saveImageToPhotosAlbum({filePath:temp,success:resolve,fail:reject}));store.toast('已存入手机相册 ♡');}else{const src=await store.saveFile(temp),id=store.uid(),original=this.photos.find(p=>p.id===this.currentId);store.update(s=>{s.photos.unshift({id,src,title:this.settings.title||'新的一帧小美好',tag:'作品',petIds:original&&original.petIds||[],date:store.date(),liked:false,template:this.settings.template});});store.toast('作品已收进回忆相册 ♡');this.loadState();}}catch(error){this.setData({error:error.errMsg||error.message||'保存失败，请检查相册授权和本机空间。'});}finally{this.setData({busy:false});this.draw();}},
 reset(){this.remember();this.settings=defaults();this.setData({selectedId:''});this.sync();this.loadImages();}
});
