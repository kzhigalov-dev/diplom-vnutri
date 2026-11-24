import {toWorld} from './geometry.js';
import {floorDisplay} from './maquette-layout.js?v=20261112-floor-fit';
import {floorRoomLayout,isFloorFurnitureSurface} from './floor-room-layout.js?v=20261124-atlas-polish';
import {pointInPolygon} from './walk-navigation.js';

const panDirections={
 ArrowLeft:{dx:1,dy:0,label:'Показать область слева',symbol:'←'},
 ArrowUp:{dx:0,dy:1,label:'Показать область сверху',symbol:'↑'},
 ArrowDown:{dx:0,dy:-1,label:'Показать область снизу',symbol:'↓'},
 ArrowRight:{dx:-1,dy:0,label:'Показать область справа',symbol:'→'},
};

export function createNavigatorPlan({container,campus,onSelect}){
 const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
 if(!ctx)throw new Error('Canvas 2D unavailable');
 canvas.setAttribute('aria-hidden','true');
 canvas.className='nav-plan-canvas';
 canvas.style.touchAction='none';
 container.prepend(canvas);
 let view=0,route=null,selected=null,zoom=1,pan=[0,0],visible=new Set(campus.entries.keys()),drag=null;
 let projection=null;
 const catalog=new Map(),furniture=new Map();
 const reference=campus.floors.get(4);
 const floors=new Map([...campus.floors].map(([number,floor])=>{
  const display=floorDisplay(floor,reference,1);
  const place=point=>{const [x,,z]=display.point(point);return [x,z];};
  const sourcePoint=(x,z)=>place(toWorld(floor.source,x,z));
  const outlines=[floor.source.footprint,...(floor.source.insets??[])].map(poly=>poly.map(point=>sourcePoint(...point)));
  const rooms=floor.spaces.map(room=>{
   const polygon=room.polygon.map(place);
   const xs=polygon.map(point=>point[0]);
   return {...room,sourceRoom:room,polygon,center:place(room.center),width:Math.max(...xs)-Math.min(...xs)};
  });
  const walls=floor.floor.walls.map(([x1,z1,x2,z2])=>[sourcePoint(x1,z1),sourcePoint(x2,z2)]);
  const stairs=floor.source.stairs.map(([x,z,w,d])=>({
   outline:[[x,z],[x+w,z],[x+w,z+d],[x,z+d]].map(point=>sourcePoint(...point)),
   treads:[.2,.4,.6,.8].map(t=>[sourcePoint(x,z+d*t),sourcePoint(x+w,z+d*t)]),
  }));
  const x=outlines.flatMap(poly=>poly.map(point=>point[0])),y=outlines.flatMap(poly=>poly.map(point=>point[1]));
  const bounds={minX:Math.min(...x),maxX:Math.max(...x),minY:Math.min(...y),maxY:Math.max(...y)};
  return [number,{outlines,bounds,rooms,walls,stairs,place}];
 }));
 function roomFurniture(room,place){
  if(!furniture.has(room.id)){
   const layout=floorRoomLayout(room.sourceRoom,catalog.get(room.id));
   const parts=layout?.parts.filter(isFloorFurnitureSurface)??[];
   furniture.set(room.id,parts.sort((a,b)=>a.y-b.y).map(part=>{
    const {scaleX,scaleZ}=layout;
    const cos=Math.cos(part.angle),sin=Math.sin(part.angle);
    const corners=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([u,v])=>{
     const x=u*part.w/2,z=v*part.d/2;
     return place([layout.x+(part.x+x*cos+z*sin)*scaleX,layout.z+(part.z-x*sin+z*cos)*scaleZ]);
    });
    return {corners,size:Math.max(part.w*scaleX,part.d*scaleZ),fill:'#'+part.color.toString(16).padStart(6,'0')};
   }));
  }
  return furniture.get(room.id);
 }
 function draw(){
  const width=container.clientWidth,height=container.clientHeight;
  if(!width||!height)return;
  const dpr=Math.min(devicePixelRatio||1,2);
  const w=Math.round(width*dpr),h=Math.round(height*dpr);
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,width,height);
  const number=view||route?.from.floor||campus.entries.get(selected)?.floor||1;
  const {outlines,bounds,rooms,walls,stairs,place}=floors.get(number);
  const spanX=bounds.maxX-bounds.minX,spanY=bounds.maxY-bounds.minY;
  const scale=Math.max(.1,Math.min((width-42)/spanX,(height-56)/spanY))*zoom;
  const limitX=Math.max(0,(width+spanX*scale)/2-Math.min(64,width/2));
  const limitY=Math.max(0,(height+spanY*scale)/2-Math.min(64,height/2));
  pan=[Math.max(-limitX,Math.min(limitX,pan[0])),Math.max(-limitY,Math.min(limitY,pan[1]))];
  const center=[(width-spanX*scale)/2+pan[0]-bounds.minX*scale,(height-spanY*scale)/2+pan[1]-bounds.minY*scale];
  const pixel=point=>[point[0]*scale+center[0],point[1]*scale+center[1]];
  projection={rooms,scale,center};
  container.dataset.floorView=String(number);
  container.dataset.projection='plan';
  function path(points,closed=false){
   if(!points.length)return;
   ctx.beginPath();ctx.moveTo(...pixel(points[0]));
   for(const point of points.slice(1))ctx.lineTo(...pixel(point));
   if(closed)ctx.closePath();
  }
  function polygon(points,fill,stroke){
   path(points,true);ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke();
  }
  for(const polygonPoints of outlines)polygon(polygonPoints,'#faf8f0','#a7a99e');
  for(const room of rooms){
   const active=room.id===selected;
   const fill=active?'#b9d7c3':visible.has(room.id)?'#b8b9b1':'#eeebe0';
   polygon(room.polygon,fill,active?'#265c47':'#9da598');
   if(active){ctx.lineWidth=2;ctx.stroke();}
   if(visible.has(room.id))for(const part of roomFurniture(room,place)){
    if(part.size*scale<.6)continue;
    path(part.corners,true);ctx.fillStyle=part.fill;ctx.fill();
   }
   if(!active&&(scale<5||!visible.has(room.id)))continue;
   const [x,y]=pixel(room.center);
   ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=active?'700 12px Golos, sans-serif':'10px Golos, sans-serif';
   const roomWidth=room.width*scale;
   if(active||ctx.measureText(room.label).width+5<roomWidth){
    ctx.fillStyle='#212b27';ctx.fillText(room.label,x,y);
   }
  }
  ctx.beginPath();
  for(const [start,end] of walls){ctx.moveTo(...pixel(start));ctx.lineTo(...pixel(end));}
  ctx.strokeStyle='#646b60';
  ctx.lineWidth=1;
  ctx.stroke();
  for(const stair of stairs){
   polygon(stair.outline,'#ececf5','#8994aa');
   for(const tread of stair.treads){path(tread);ctx.strokeStyle='#8994aa';ctx.stroke();}
  }
  if(!route)return;
  for(const segment of route.segments.filter(segment=>segment.floor===number)){
   ctx.lineJoin='round';ctx.lineCap='round';
   path(segment.points.map(place));ctx.strokeStyle='#fff';ctx.lineWidth=7;ctx.stroke();
   ctx.strokeStyle='#0064cf';ctx.lineWidth=4;ctx.stroke();
  }
  function marker(point,color,label){
   const [x,y]=pixel(place(point));
   ctx.beginPath();ctx.arc(x,y,7,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();ctx.lineWidth=2;ctx.strokeStyle='#fff8ed';ctx.stroke();
   if(label){
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='700 9px Golos, sans-serif';ctx.fillStyle='white';ctx.fillText(label,x,y);
   }
  }
  for(const connection of route.connections){
   const label=connection.kind==='lift'?'Л':connection.stairNumber?String(connection.stairNumber):'';
   if(connection.fromFloor===number)marker(connection.from,'#775b3e',label);
   if(connection.toFloor===number)marker(connection.to,'#775b3e',label);
  }
  if(route.from.floor===number)marker(route.from.point,'#3c514a','А');
  if(route.to.floor===number)marker(route.to.point,'#0064cf','Б');
 }
 let redrawFrame=null;
 function scheduleDraw(){
  if(redrawFrame!==null)return;
  redrawFrame=requestAnimationFrame(()=>{
   redrawFrame=null;
   draw();
  });
 }
 function updateDrag(event){
  if(drag?.pointerId!==event.pointerId)return;
  const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
  if(!drag.moved&&Math.hypot(dx,dy)<5)return;
  drag.moved=true;
  pan=[drag.pan[0]+dx,drag.pan[1]+dy];scheduleDraw();
 }
 function endDrag(event){
  if(drag?.pointerId===event.pointerId)drag=null;
 }
 canvas.addEventListener('pointerdown',event=>{
  if(!event.isPrimary||event.button!==0||drag)return;
  canvas.setPointerCapture(event.pointerId);
  drag={pointerId:event.pointerId,x:event.clientX,y:event.clientY,pan:[...pan],moved:false};
 });
 canvas.addEventListener('pointermove',updateDrag);
 canvas.addEventListener('lostpointercapture',endDrag);
 canvas.addEventListener('pointercancel',endDrag);
 canvas.addEventListener('pointerup',event=>{
  if(drag?.pointerId!==event.pointerId)return;
  updateDrag(event);
  const {moved}=drag;
  drag=null;
  if(moved||!projection)return;
  const rect=canvas.getBoundingClientRect(),{rooms,scale,center}=projection;
  const point=[(event.clientX-rect.left-center[0])/scale,(event.clientY-rect.top-center[1])/scale];
  const room=rooms.find(item=>visible.has(item.id)&&pointInPolygon(point,item.polygon));
  if(room)onSelect(room.id);
 });
 function panBy({dx,dy}){
  pan=[pan[0]+dx*48,pan[1]+dy*48];
  draw();
 }
 const controls=document.createElement('div');
 controls.className='nav-plan-pan';
 controls.setAttribute('role','group');
 controls.setAttribute('aria-label','Смещение плана');
 for(const {dx,dy,label,symbol} of Object.values(panDirections)){
  const button=document.createElement('button');
  button.type='button';
  button.textContent=symbol;
  button.setAttribute('aria-label',label);
  button.title=label;
  button.addEventListener('click',()=>panBy({dx,dy}));
  controls.append(button);
 }
 container.append(controls);
 function handlePanKey(event){
  if(event.target!==container||event.altKey||event.ctrlKey||event.metaKey)return;
  if(!Object.hasOwn(panDirections,event.key))return;
  event.preventDefault();
  panBy(panDirections[event.key]);
 }
 container.addEventListener('keydown',handlePanKey);
 const reset=()=>{drag=null;zoom=1;pan=[0,0];draw();};
 const observer=new ResizeObserver(draw);observer.observe(container);
 return {
  get view(){return Number(container.dataset.floorView)||1;},
  setView(number){view=Number(number)||0;reset();},
  focusRoom(id){view=campus.entries.get(id)?.floor??view;reset();},
  setRoute(value){route=value;draw();},
  select(id){selected=id;draw();},
  setVisible(ids){visible=new Set(ids);draw();},
  setRoomCatalog(rooms){
   for(const room of rooms){
    if(!room.spaceId)continue;
    catalog.set(room.spaceId,room);
    furniture.delete(room.spaceId);
   }
   draw();
  },
  zoom(factor){zoom=Math.min(5,Math.max(.65,zoom*factor));draw();},
  reset,
  dispose(){
   if(redrawFrame!==null)cancelAnimationFrame(redrawFrame);
   observer.disconnect();
   container.removeEventListener('keydown',handlePanKey);
   controls.remove();
   canvas.remove();
  },
 };
}
