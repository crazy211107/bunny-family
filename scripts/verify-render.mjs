import {build} from 'esbuild';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'output','verify-render.cjs');
await fs.mkdir(path.dirname(out),{recursive:true});
await build({stdin:{resolveDir:root,sourcefile:'verify-source-render.jsx',loader:'jsx',contents:`
import React from 'react';
import {renderToString} from 'react-dom/server';
import assert from 'node:assert/strict';
import App from './src/App.jsx';
import Home from './src/Home.jsx';
import Pets from './src/Pets.jsx';
import Family from './src/Family.jsx';
import Diary,{NoteEditor} from './src/Diary.jsx';
import Album,{PhotoTheater} from './src/Album.jsx';
import Studio from './src/Studio.jsx';
import {createInitialState} from './src/data.js';
const blank=()=>{};let checks=0;
function render(name,C,state,extra={}){const html=renderToString(React.createElement(C,{state,setState:blank,notify:blank,open:blank,go:blank,upload:blank,onClose:blank,onEdit:blank,selected:'qiu',setSelected:blank,...extra}));assert.ok(html.length>100,name);assert.ok(!html.includes('undefined</'),name);checks++;console.log('PASS '+name);return html;}
const base=createInitialState();
assert.ok(render('应用初始输出',App,base).includes('豆米'));
for(const [name,C] of [['首页',Home],['兔兔档案',Pets],['家人',Family],['日记',Diary],['相册',Album],['工坊',Studio]])render(name,C,base);
const empty={...base,photos:[],notes:[],members:[]};
assert.ok(render('空首页不崩溃',Home,empty).includes('empty-frame'));
for(const [name,C] of [['空日记',Diary],['空相册',Album],['空照片工坊',Studio],['空家庭',Family]])render(name,C,empty);
render('仅一张照片放映',PhotoTheater,base,{id:'p1',ids:['p1']});
render('失效和重复放映ID安全处理',PhotoTheater,base,{id:'missing',ids:['p1','missing','p1']});
render('空放映集合安全处理',PhotoTheater,empty,{id:'missing',ids:[]});
const archived={...base,photos:base.photos.map(p=>({...p,trashedAt:'2026-10-27T00:00:00Z'}))};
render('全部照片收起后的首页',Home,archived);
const note={id:'n',title:'旧信笺',body:'保留旁白',date:'2026-10-27',createdAt:'2026-10-27T00:00:00Z',photoIds:['p1','p2','p3','p4'],petIds:['qiu'],tags:[]};
assert.ok(render('隐藏关联照片可取消',NoteEditor,archived,{note}).includes('取消已收起照片'));
render('日记原ID编辑表单',NoteEditor,{...base,notes:[note]},{note});
console.log(checks+' source render checks passed; no browser interaction or viewport claims.');
`},bundle:true,platform:'node',format:'cjs',outfile:out,loader:{'.css':'empty'},logLevel:'silent'});
try{createRequire(import.meta.url)(out);}finally{await fs.unlink(out);}
