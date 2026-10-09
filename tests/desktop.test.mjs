import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {setupUpdates} from '../electron/updates.cjs';

test('desktop close hides to tray, Show restores it, and Quit saves placement', async () => {
  const dir=mkdtempSync(path.join(tmpdir(),'siya-desktop-test-'));
  const require=createRequire(import.meta.url);
  const windows=[], trays=[];
  class Window extends EventEmitter {
    constructor(options){super();this.options=options;this.visible=true;windows.push(this);this.webContents=new EventEmitter();this.webContents.setWindowOpenHandler=()=>{};}
    loadFile(){} loadURL(){} hide(){this.visible=false;} show(){this.visible=true;} focus(){} restore(){} maximize(){} close(){this.emit('closed');}
    isDestroyed(){return false;} isMinimized(){return false;} isMaximized(){return false;}
    getNormalBounds(){return {x:120,y:100,width:1100,height:720};}
    static getAllWindows(){return windows;}
  }
  class Tray extends EventEmitter {
    constructor(){super();trays.push(this);} setToolTip(){} setContextMenu(menu){this.menu=menu;} destroy(){}
  }
  const app=new EventEmitter();
  Object.assign(app,{isPackaged:false,requestSingleInstanceLock:()=>true,whenReady:async()=>{},getPath:()=>dir,setAppUserModelId(){},quit(){this.emit('before-quit');}});
  const backend=new EventEmitter();
  Object.assign(backend,{stdout:new EventEmitter(),stderr:new EventEmitter(),kill(){this.killed=true;}});
  const fakeElectron={app,BrowserWindow:Window,Tray,Menu:{setApplicationMenu(){},buildFromTemplate:x=>x},shell:{},dialog:{showErrorBox(_t,m){throw Error(m);}},
    ipcMain:{removeHandler(){},handle(){}},desktopCapturer:{},session:{defaultSession:{}},screen:{getAllDisplays:()=>[{workArea:{x:0,y:0,width:1920,height:1080}}]},
    nativeImage:{createFromPath:()=>({resize:()=>({isEmpty:()=>false})})},Notification:{}};
  const fakeProcess=new EventEmitter();
  Object.assign(fakeProcess,{env:{},platform:'linux',execPath:process.execPath,stdout:{write(){}},stderr:{write(){}}});
  const mainPath=path.resolve('electron/main.cjs');
  const context={require:(name)=>{
    if(name==='electron')return fakeElectron;
    if(name==='child_process')return {spawn:()=>backend,execFile:(...args)=>{const cb=args[args.length-1];if(typeof cb==='function')queueMicrotask(()=>cb(null,'',''));}};
    if(name==='http')return {get:(_url,callback)=>{queueMicrotask(()=>callback({resume(){}}));const req=new EventEmitter();req.setTimeout=()=>{};return req;}};
    if(name==='./updates.cjs')return {setupUpdates:()=>({check(){},dispose(){}})};
    if(name.startsWith('./'))return require(path.resolve('electron',name));
    return require(name);
  },process:fakeProcess,__dirname:path.dirname(mainPath),console,setTimeout,clearTimeout,setInterval,clearInterval,queueMicrotask};
  try {
    vm.runInNewContext(readFileSync(mainPath,'utf8'),context,{filename:mainPath});
    await new Promise(resolve=>setImmediate(resolve));
    const main=windows.at(-1);
    assert.equal(windows.length,2);
    assert.equal(trays.length,1);
    let prevented=false;
    main.emit('close',{preventDefault(){prevented=true;}});
    assert.equal(prevented,true);
    assert.equal(main.visible,false);
    trays[0].menu.find(i=>i.label==='Show Siya').click();
    assert.equal(main.visible,true);
    assert.equal(JSON.parse(readFileSync(path.join(dir,'window-state.json'),'utf8')).width,1100);
    trays[0].menu.find(i=>i.label==='Quit Siya').click();
    assert.equal(backend.killed,true);
    prevented=false;
    main.emit('close',{preventDefault(){prevented=true;}});
    assert.equal(prevented,false);
  } finally {rmSync(dir,{recursive:true,force:true});}
});

test('packaged updater checks its feed and defers installation until accepted', async () => {
  const dir=mkdtempSync(path.join(tmpdir(),'siya-update-test-'));
  const previous=process.resourcesPath;
  process.resourcesPath=dir;
  writeFileSync(path.join(dir,'app-update.yml'),'provider: generic\nurl: https://example.test/releases\n');
  const updater=new EventEmitter();let installs=0,checks=0;
  updater.checkForUpdates=async()=>{checks++;return {};};
  updater.quitAndInstall=()=>{installs++;};
  let choice=0;
  const app=new EventEmitter();app.isPackaged=true;
  const controls=setupUpdates({app,updater,dialog:{showMessageBox:async()=>({response:choice})},Notification:{isSupported:()=>false},getWindow:()=>undefined});
  try {
    await controls.check(true);
    assert.equal(checks,1);
    updater.emit('update-downloaded');
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(installs,0);
    choice=1;
    await controls.check(true);
    assert.equal(installs,1);
    assert.equal(updater.autoInstallOnAppQuit,false);
  } finally {
    controls.dispose();
    if(previous===undefined)delete process.resourcesPath;else process.resourcesPath=previous;
    rmSync(dir,{recursive:true,force:true});
  }
});
