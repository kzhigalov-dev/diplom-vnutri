import * as THREE from 'three';
import {createFloorEnvelope} from './floor-envelope.js?v=20261114-spatial';
import {OrbitControls} from '../vendor/OrbitControls.js';
import {createMotion} from './navigation-motion.js';
import {toWorld} from './geometry.js';
import {createMaquetteProps} from './maquette-props.js?v=20261124-furnished-plans';
import {createFloorFurniture} from './floor-furniture.js?v=20261124-atlas-polish';
import {createCampusExterior} from './campus-exterior.js?v=20261124-atlas-polish';
import {floorDisplay,roomBounds,stairDisplay} from './maquette-layout.js?v=20261112-floor-fit';
import {pilotRoomBySpace} from './pilot-spaces.js?v=20261113-navigation';
import {createRoutePreview,sampleRoutePreview} from './route-preview.js?v=20261112-visit';
import {buildPlannedStair,buildRouteStair} from './route-stair.js?v=20261112-floor-fit';
import {createCatalogModel,roomFloorColor} from './room-catalog-model.js?v=20261124-atlas-polish';

export function createNavigatorScene({container,campus,onSelect,onFloor,onFailure,onPreview=()=>{}}){
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
 const maxRenderPixels=2600000;
 renderer.setClearColor(0xe8e7dc,0);
 renderer.toneMapping=THREE.AgXToneMapping;
 renderer.toneMappingExposure=1.04;
 container.prepend(renderer.domElement);renderer.domElement.setAttribute('aria-hidden','true');
 const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-50,50,35,-35,.1,400);
 const controls=new OrbitControls(camera,renderer.domElement),motion=createMotion(),turnMotion=createMotion();
 controls.enableDamping=false;controls.minZoom=.5;controls.maxZoom=16;controls.maxPolarAngle=1.35;controls.minPolarAngle=.015;
 controls.target.set(0,20,0);camera.position.set(43,78,70);
 scene.add(new THREE.HemisphereLight(0xfffcf2,0xa0a89f,1.48));
 const sun=new THREE.DirectionalLight(0xfff0dc,3.15);
 sun.position.set(-35,65,-46);
 scene.add(sun);
 const fill=new THREE.DirectionalLight(0xe3edf2,.88);
 fill.position.set(38,30,42);
 scene.add(fill);
 const box=new THREE.BoxGeometry(1,1,1),floorGroups=new Map(),roomMeshes=new Map(),labels=new Map(),floorLabels=[],stairLabels=[];
 const resources=new Set([box]),materials=new Set(),textures=new Set(),labelLayer=document.createElement('div');
 labelLayer.className='nav-map-labels';
 container.append(labelLayer);
 const stairTags=Array.from({length:2},()=>{
  const tag=document.createElement('span');
  tag.className='nav-stair-label nav-stair-endpoint';
  tag.setAttribute('aria-hidden','true');
  tag.hidden=true;
  container.append(tag);
  return tag;
 });
 const preview=document.createElement('div');preview.className='nav-map-preview';preview.hidden=true;preview.setAttribute('role','tooltip');container.append(preview);
 let hoveredFloor=null;
 const extraFloorGap=13;
 let overviewMode='building',floorGap=0,focusedRoom=null,catalogModel=null;
 const depthScale=2.2;
 const reference=campus.floors.get(4);
 const display=new Map([...campus.floors].map(([number,floor])=>[number,floorDisplay(floor,reference,depthScale)]));
 const sceneWorld=(floor,p,y=.12)=>display.get(floor).point(p,y);
 let selected=null,hovered=null,visible=new Set(campus.entries.keys()),view=0,topView=false;
 let routeGroup=null,traveller=null,previewPath=null,previewProgress=0,playing=false,previewFrame=null,previewTime=null;
 let stairFocus=null;
 const routeStairs=new Map(),routeSurfaces=[],routeEndpoints=[],routeFloors=new Set();
 let disposed=false,failed=false,viewRevision=0,transitioning=false,portraitState=null,down=null,renderFrame=null;
 let mapWidth=1,mapHeight=1,hoverPointer=null,labelOrder=[];
 const projectedPosition=new THREE.Vector3();
 const floorColors=[0xe9a174,0xb4c5a0,0xc6b6db,0xf1c568,0xc4dce0];
 function material(options,Material=THREE.MeshStandardMaterial){const m=new Material(options);materials.add(m);return m;}
 function shapeGeometry(f,polygons,depth=0){
  const shapes=polygons.map(poly=>{
   const shape=new THREE.Shape();
   for(const [index,point] of poly.entries()){
    const [x,z]=toWorld(f,...point);
    if(index)shape.lineTo(x,-z);
    else shape.moveTo(x,-z);
   }
   shape.closePath();
   return shape;
  });
  const g=depth?new THREE.ExtrudeGeometry(shapes,{depth,bevelEnabled:false}):new THREE.ShapeGeometry(shapes);g.rotateX(-Math.PI/2);resources.add(g);return g;
 }
 function trackedGeometry(g){resources.add(g);return g;}
 const furniture=createFloorFurniture({box,material,depthScale});
 for(const [number,f] of campus.floors){
  const placement=display.get(number);
  const group=new THREE.Group();
  group.position.set(placement.x,(number-1)*10,placement.z);
  group.rotation.y=placement.rotation;
  group.scale.set(placement.scale,1,depthScale*placement.scale);
  scene.add(group);
  const palette={
   plate:material({color:0xdad7c9,roughness:.94}),
   edge:material({color:0xa69d87,roughness:.9}),
   wall:material({color:0xd3d2ca,roughness:.95}),
   sill:material({color:number===1?0x656f68:0xc8c3af,roughness:.9}),
   trim:material({color:0xe8deca,roughness:.86}),
   frame:material({color:0x65746c,roughness:.72,metalness:.08}),
   glass:material({color:0xa0beb9,roughness:.42,metalness:.09}),
   room:material({color:roomFloorColor,roughness:.86}),
   selected:material({color:0xeeb76b,roughness:.65,emissive:0xb97829,emissiveIntensity:.19}),
   hover:material({color:0xb9c9ad,roughness:.72}),
   stair:material({color:0x818f83,roughness:.8})
  };
  Object.values(palette).forEach(m=>{m.userData.baseOpacity=1;});palette.glass.userData.baseOpacity=.24;palette.glass.opacity=.24;palette.glass.transparent=true;palette.glass.depthWrite=false;
  const plate=new THREE.Mesh(shapeGeometry(f.source,[f.source.footprint,...(f.source.insets||[])],.55),[palette.plate,palette.edge]);plate.position.y=-.55;plate.userData.floor=number;group.add(plate);
  const walls=new THREE.InstancedMesh(box,palette.wall,f.floor.walls.length),dummy=new THREE.Object3D();
  f.floor.walls.forEach((s,i)=>{const a=toWorld(f.source,s[0],s[1]),b=toWorld(f.source,s[2],s[3]);const height=.76;dummy.position.set((a[0]+b[0])/2,height/2,(a[1]+b[1])/2);dummy.rotation.y=-Math.atan2(b[1]-a[1],b[0]-a[0]);dummy.scale.set(Math.hypot(b[0]-a[0],b[1]-a[1]),height,Math.max(.06,s[4]*80/f.source.imageWidth));dummy.updateMatrix();walls.setMatrixAt(i,dummy.matrix);});group.add(walls);
  const envelope=createFloorEnvelope({source:f.source,box,palette});group.add(envelope.group);
  const outlineMaterial=new THREE.LineBasicMaterial({color:0xd5794f,transparent:true,opacity:1,depthTest:false});materials.add(outlineMaterial);
  const rims=[];
  for(const space of f.spaces){
   const polygons=[space.polygon.map(p=>[(p[0]/80+.5)*f.source.imageWidth,p[1]*f.source.imageWidth/80+f.source.imageHeight/2])];
   const mesh=new THREE.Mesh(shapeGeometry(f.source,polygons,.10),palette.room);mesh.position.y=.02;mesh.userData.spaceId=space.id;group.add(mesh);roomMeshes.set(space.id,mesh);
   const outline=new THREE.LineSegments(trackedGeometry(new THREE.EdgesGeometry(mesh.geometry)),outlineMaterial);outline.position.y=.04;outline.visible=false;mesh.add(outline);rims.push(outline);
   const button=document.createElement('button');button.type='button';button.className='nav-room-label';button.addEventListener('click',()=>onSelect(space.id));button.addEventListener('pointerdown',e=>e.stopPropagation());
   button.addEventListener('pointerenter',()=>hover(space.id));button.addEventListener('pointerleave',()=>hover(null));button.addEventListener('focus',()=>hover(space.id));button.addEventListener('blur',()=>hover(null));
   button.hidden=true;
   labelLayer.append(button);labels.set(space.id,{button,space,outline,priority:pilotRoomBySpace(space.id)?2:space.directoryRoom?1:0,position:new THREE.Vector3(...sceneWorld(number,space.center,.82))});
  }
  const stairParts=[[],[]];
  for(const stairIndex of f.source.stairs.keys()){
   const layout=stairDisplay(f.source,stairIndex,([x,z])=>[x,0,z]);
   const [x,,z]=layout.center;
   const stair=buildPlannedStair([x,.06,z],[x,.48,z],true,layout);
   const main=f.landings.some(landing=>landing.isMain&&landing.index===stairIndex);
   stairParts[Number(main)].push(...stair.treads,...stair.landings);
  }
  const stairs=stairParts.flatMap((parts,index)=>{
   if(!parts.length)return [];
   const mesh=new THREE.InstancedMesh(box,index?palette.selected:palette.stair,parts.length);
   for(const [i,part] of parts.entries()){
    dummy.position.set(...part.position);
    dummy.scale.set(...part.size);
    dummy.rotation.set(0,part.rotationY,0);
    dummy.updateMatrix();
    mesh.setMatrixAt(i,dummy.matrix);
   }
   group.add(mesh);
   return [mesh];
  });
  for(const landing of f.landings){const b=document.createElement('span');b.className='nav-stair-label';b.textContent=landing.label||'Лестница';b.hidden=true;labelLayer.append(b);stairLabels.push({button:b,number,main:Boolean(landing.isMain),position:new THREE.Vector3(...sceneWorld(number,landing.center,1))});}
  const label=document.createElement('button');label.style.setProperty('--floor-color','#'+floorColors[number-1].toString(16));label.className='nav-level-label';label.type='button';label.innerHTML=`<span>${number}</span><small>этаж</small>`;label.setAttribute('aria-label',`${number}-й этаж`);label.addEventListener('click',()=>onFloor(number));labelLayer.append(label);
  label.addEventListener('pointerenter',()=>previewFloor(number));
  label.addEventListener('pointerleave',()=>previewFloor(null));
  label.addEventListener('focus',()=>previewFloor(number));
  label.addEventListener('blur',()=>previewFloor(null));
  const displayBoundary=[f.source.footprint,...(f.source.insets||[])].flat().map(p=>sceneWorld(number,toWorld(f.source,...p),.6));
  floorLabels.push({button:label,number,boundary:displayBoundary.map(p=>new THREE.Vector3(...p))});
  floorGroups.set(number,{group,palette,walls,plate,rims,outlineMaterial,envelope,stairs});
  furniture.addFloor(number,f.spaces,group);
 }
 const decor=createMaquetteProps({campus,box,material,track:trackedGeometry,textures});
 for(const [n,f] of floorGroups){f.decor=decor.floors.get(n);f.group.add(f.decor);}
 for(const root of decor.roomShowcases.values()){root.visible=false;root.position.y=30;scene.add(root);}
 const routeStart=campus.entries.get('start-1');
 // Use the same visual coordinates as the indoor route, including the first-floor rotation.
 const entranceX=routeStart?.point?sceneWorld(routeStart.floor,routeStart.point)[0]:undefined;
 const exterior=createCampusExterior({campus,box,material,track:trackedGeometry,textures,depthScale,entranceX});
 const assembled=new THREE.Group();scene.add(assembled);
 for(const g of exterior.facades.values())assembled.add(g);
 assembled.add(exterior.roof,exterior.site);
 const shellMaterials=new Map();assembled.traverse(object=>{if(!object.material)return;const source=object.material;let owner=object;while(owner&&!owner.userData.floor)owner=owner.parent;const floor=owner?.userData.floor||0,key=floor+':'+source.uuid;if(!shellMaterials.has(key)){const clone=source.clone();clone.userData.preserveTransparency=source.transparent;materials.add(clone);shellMaterials.set(key,{material:clone,floor,baseColor:clone.color.clone()});}object.material=shellMaterials.get(key).material;});let shellMix=1;
 // Opaque geometry should stay in the opaque render pass. Only move it to the
 // transparent pass while fading; otherwise overlapping floors sort poorly.
 function setMaterialOpacity(m,value){const transparent=value<.999||Boolean(m.userData.preserveTransparency);if(m.transparent!==transparent){m.transparent=transparent;m.needsUpdate=true;}m.opacity=value;m.depthWrite=value>.5;}
 function setShell(value,gap=floorGap){
  floorGap=gap;
  shellMix=value;
  assembled.visible=value>.001;
  exterior.roof.position.y=(1-value)*5.5;
  const peeking=hoveredFloor&&isBuilding()&&value>.99;
  for(const {material:m,floor,baseColor} of shellMaterials.values()){setMaterialOpacity(m,value*(peeking?(floor===hoveredFloor ? .30 : floor ? .085 : .28):1));m.color.copy(baseColor);if(peeking&&floor===hoveredFloor)m.color.lerp(new THREE.Color(0xe5b77d),.35);}
  for(const [n,f] of floorGroups){
   const active=peeking&&n===hoveredFloor;
   const highlighted=active||allFloorsVisible()&&n===hoveredFloor;
   f.group.position.y=active?exterior.levelBases[n-1]+.12:(n-1)*(10+gap);
   f.group.visible=!focusedRoom&&stairFocus===null&&(active||value<.42&&floorInView(n));
   f.palette.plate.emissive.set(highlighted?0x56725f:0x000000);
   f.palette.plate.emissiveIntensity=highlighted?.28:0;
   f.palette.edge.emissive.copy(f.palette.plate.emissive);
   f.palette.edge.emissiveIntensity=highlighted?.45:0;
  }
 }
 function previewFloor(number){
  number=Number(number)||null;
  const building=isBuilding();
  if((!building&&!allFloorsVisible())||transitioning||down||!floorGroups.has(number))number=null;
  if(hoveredFloor===number)return;
  if(number)hover(null);
  hoveredFloor=number;
  container.dataset.hoverFloor=number?String(number):'';
  for(const item of floorLabels)item.button.toggleAttribute('data-highlighted',item.number===number);
  setShell(shellMix);
  preview.replaceChildren();
  preview.hidden=!number||!building;
  if(number&&building){
   const title=document.createElement('strong');
   title.textContent=number+' этаж';
   const hint=document.createElement('span');
   hint.textContent='Нажмите, чтобы открыть';
   preview.append(title,hint);
  }
  updateHoverCursor();
  render();
 }

 const {minX,maxX,minZ,maxZ}=exterior.bounds;
 const centerX=(minX+maxX)/2,centerZ=(minZ+maxZ)/2;
 const plinthWidth=maxX-minX+5,plinthDepth=maxZ-minZ+7;
 const roofHeight=new THREE.Box3().setFromObject(exterior.roof).max.y;
 const buildingPoints=exterior.footprint.map(([x,z])=>new THREE.Vector3(x,roofHeight,z));
 for(const x of [centerX-plinthWidth/2,centerX+plinthWidth/2]){
  for(const z of [Math.min(minZ-3.5,exterior.front.z-6.7),maxZ+3.5]){
   buildingPoints.push(new THREE.Vector3(x,-1,z));
  }
 }
 // Bake the plinth and courtyard shadows once. The latter follows the open wings.
 function contactShadow(width,depth,y,polygon,blur,alpha){
  const textureSize=512;
  const canvas=document.createElement('canvas');
  canvas.width=textureSize;
  canvas.height=textureSize;
  const context=canvas.getContext('2d');
  context.filter=`blur(${blur}px)`;
  context.fillStyle=`rgba(34,44,32,${alpha})`;
  context.beginPath();
  for(const [index,[x,z]] of polygon.entries()){
   const px=(.5+(x-centerX)/width)*textureSize;
   const pz=(.5+(z-centerZ)/depth)*textureSize;
   if(index===0)context.moveTo(px,pz);
   else context.lineTo(px,pz);
  }
  context.closePath();
  context.fill();
  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;
  textures.add(texture);
  const surface=new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,toneMapped:false});
  materials.add(surface);
  const mesh=new THREE.Mesh(trackedGeometry(new THREE.PlaneGeometry(width,depth)),surface);
  mesh.rotation.x=-Math.PI/2;
  mesh.position.set(centerX,y,centerZ);
  return mesh;
 }
 const shadow=new THREE.Group();
 const plinthOutline=[
  [centerX-plinthWidth/2,centerZ-plinthDepth/2],
  [centerX+plinthWidth/2,centerZ-plinthDepth/2],
  [centerX+plinthWidth/2,centerZ+plinthDepth/2],
  [centerX-plinthWidth/2,centerZ+plinthDepth/2],
 ];
 shadow.add(contactShadow(plinthWidth+24,plinthDepth+24,-1.02,plinthOutline,21,.34));
 shadow.add(contactShadow(plinthWidth+9,plinthDepth+9,-.24,exterior.footprint.map(([x,z])=>[x+.45,z+.85]),8,.36));
 scene.add(shadow);
 function isBuilding(){return !focusedRoom&&!view&&overviewMode==='building';}
 function allFloorsVisible(){return !focusedRoom&&!view&&stairFocus===null&&overviewMode==='floors';}
 function targetFloorGap(){return allFloorsVisible()?extraFloorGap:0;}
 function floorInView(number){return view?number===view:!routeFloors.size||routeFloors.has(number);}
 function floorVisible(number){return !focusedRoom&&stairFocus===null&&!isBuilding()&&floorInView(number);}
 function showWorld(){setShell(isBuilding()?1:0,targetFloorGap());shadow.visible=true;container.dataset.overview=overviewMode;}
 function roomContext(){
  container.dataset.roomFocus=focusedRoom||'';for(const [id,root] of decor.roomShowcases)root.visible=!catalogModel&&id===focusedRoom;for(const [n,f] of floorGroups)f.group.visible=floorVisible(n);
  for(const [n,f] of floorGroups){for(const child of f.group.children){if(child===decor.floors.get(n))continue;child.visible=focusedRoom?child===roomMeshes.get(focusedRoom):child.userData.spaceId?visible.has(child.userData.spaceId):true;}}
  for(const [id,p] of decor.roomProps)p.visible=focusedRoom?id===focusedRoom:visible.has(id);
  routeVisibility();
 }
 function project(position,yOffset=0){
  projectedPosition.copy(position).y+=yOffset;
  const p=projectedPosition.project(camera);
  return {x:(p.x+1)*mapWidth/2,y:(1-p.y)*mapHeight/2,z:p.z};
 }
 function orderLabels(){
  labelOrder=[...labels.values()].sort((a,b)=>
   Number(b.space.id===selected)-Number(a.space.id===selected)||
   Number(b.space.id===hovered)-Number(a.space.id===hovered)||b.priority-a.priority);
 }
 function render(){
  if(disposed||failed||document.hidden||renderFrame!==null)return;
  renderFrame=requestAnimationFrame(draw);
 }
 function stopRendering(){
  if(renderFrame!==null)cancelAnimationFrame(renderFrame);
  renderFrame=null;
 }
 function draw(){
  renderFrame=null;
  if(disposed||failed||document.hidden)return;
  if(hoverPointer){
   const point=hoverPointer;
   hoverPointer=null;
   const hit=hitObject(point,{includeRooms:true});
   if(hit?.userData.floor){
    previewFloor(hit.userData.floor);
   }else{
    previewFloor(null);
    hover(hit?.userData.spaceId??null);
   }
  }
  shadow.visible=isBuilding();
  for(const [n,f] of floorGroups)if(f.group.visible)furniture.prepareFloor(n,visible,Boolean(view&&!topView));
  renderer.render(scene,camera);
  labelLayer.hidden=stairFocus!==null;
  const width=mapWidth,height=mapHeight;
  const activeStair=routeStairs.get(stairFocus);
  for(const [index,tag] of stairTags.entries()){
   const landing=activeStair?.landings[index];
   const p=landing&&project(activeStair.group.localToWorld(landing.position.clone()));
   tag.hidden=!p||p.x<28||p.x>width-28||p.y<24||p.y>height-24||Math.abs(p.z)>=1;
   if(!tag.hidden){
    tag.textContent=`${landing.floor} этаж`;
    tag.style.left=p.x+'px';
    tag.style.top=(p.y+(index===0?20:-17))+'px';
   }
  }
  if(activeStair)return;
  const occupied=[],isMobile=matchMedia('(max-width:700px)').matches;
  const placedFloorLabels=[];
  for(const item of floorLabels){
   const p=!focusedRoom&&!isBuilding()&&!view&&floorInView(item.number)&&
    item.boundary.map(point=>project(point,(item.number-1)*floorGap)).reduce((left,current)=>current.x<left.x?current:left);
   item.button.hidden=!p||Math.abs(p.z)>1||p.y<20||p.y>height-20;
   if(!item.button.hidden)placedFloorLabels.push({item,x:p.x,y:p.y});
  }
  placedFloorLabels.sort((a,b)=>a.y-b.y);
  const sampleBadgeHeight=placedFloorLabels[0]?.item.button.offsetHeight||(isMobile?42:48);
  const minFloorGap=sampleBadgeHeight+4;
  const minFloorY=Math.ceil(sampleBadgeHeight/2)+4,maxFloorY=height-Math.ceil(sampleBadgeHeight/2)-4;
  for(let i=1;i<placedFloorLabels.length;i++){
   if(placedFloorLabels[i].y-placedFloorLabels[i-1].y<minFloorGap){
    placedFloorLabels[i].y=placedFloorLabels[i-1].y+minFloorGap;
   }
  }
  const lastLabel=placedFloorLabels.at(-1);
  if(lastLabel&&lastLabel.y>maxFloorY){
   const shift=lastLabel.y-maxFloorY;
   for(const entry of placedFloorLabels)entry.y-=shift;
   if(placedFloorLabels[0].y<minFloorY){
    placedFloorLabels[0].y=minFloorY;
    for(let i=1;i<placedFloorLabels.length;i++){
     placedFloorLabels[i].y=Math.max(placedFloorLabels[i].y,placedFloorLabels[i-1].y+minFloorGap);
    }
   }
  }
  for(const {item,x,y} of placedFloorLabels){
   if(y>maxFloorY){item.button.hidden=true;continue;}
   item.button.style.left=Math.max(26,Math.min(width-26,x-28))+'px';
   item.button.style.top=y+'px';
  }
  for(const endpoint of routeEndpoints){const p=project(endpoint.position),show=routeGroup?.visible&&!focusedRoom&&(!view||view===endpoint.floor)&&p.z>-1&&p.z<1&&p.x>36&&p.x<width-36&&p.y>35&&p.y<height-30;endpoint.label.hidden=!show;if(show){endpoint.label.style.left=p.x+'px';endpoint.label.style.top=(p.y-12)+'px';}}
  for(const item of (routeGroup?[]:stairLabels).filter(item=>item.main&&item.number===view)){const p=project(item.position);if(p.z>-1&&p.z<1)occupied.push(p);}
  const showRoomLabels=!routeGroup&&!focusedRoom&&!isBuilding()&&!allFloorsVisible()&&!(transitioning&&assembled.visible);
  for(const {space,button,position,priority} of labelOrder){
   const eligible=showRoomLabels&&visible.has(space.id)&&(view?view===space.floor:priority>0||space.id===selected);
   const p=eligible&&project(position);
   const show=p&&Math.abs(p.z)<1&&p.x>35&&p.x<width-40&&p.y>26&&p.y<height-32&&
    !occupied.some(q=>Math.abs(q.x-p.x)<(isMobile?58:63)&&Math.abs(q.y-p.y)<31);
   if(button.hidden!==!show)button.hidden=!show;
   if(show){
    button.style.left=p.x+'px';
    button.style.top=p.y+'px';
    occupied.push(p);
   }
  }
  for(const item of stairLabels){const p=project(item.position),show=!routeGroup&&!focusedRoom&&!(transitioning&&assembled.visible)&&view===item.number&&p.z>-1&&p.z<1&&p.x>28&&p.x<width-45&&p.y>26&&p.y<height-32&&(item.main||!occupied.some(q=>Math.abs(q.x-p.x)<78&&Math.abs(q.y-p.y)<28));item.button.hidden=!show;if(show){item.button.style.left=p.x+'px';item.button.style.top=p.y+'px';occupied.push(p);}}
  if(hoveredFloor&&isBuilding()){const p=project(new THREE.Vector3(exterior.front.x,exterior.levelBases[hoveredFloor-1]+1,exterior.front.z));preview.hidden=false;preview.style.left=Math.max(105,Math.min(width-105,p.x))+'px';preview.style.top=Math.max(100,Math.min(height-75,p.y-38))+'px';}
  if(hovered){const item=labels.get(hovered),p=project(item.position,(item.space.floor-1)*floorGap);preview.hidden=p.z< -1||p.z>1;preview.style.left=Math.max(110,Math.min(width-110,p.x))+'px';preview.style.top=Math.max(125,Math.min(height-90,p.y-45))+'px';}
 }
 function applyMaterial(id){const mesh=roomMeshes.get(id),f=floorGroups.get(labels.get(id).space.floor);mesh.material=id===selected&&!focusedRoom?f.palette.selected:id===hovered?f.palette.hover:f.palette.room;labels.get(id).outline.visible=id===selected||id===hovered;}
 function hover(id){
  if(id===hovered||(id&&(down||transitioning)))return;
  const old=hovered;
  hovered=id;
  if(old)applyMaterial(old);
  if(id){
   applyMaterial(id);
   const {space,priority}=labels.get(id);
   const title=document.createElement('strong');
   title.textContent=space.label+' · '+space.floor+' этаж';
   const text=document.createElement('span');
   text.textContent=space.displayName||'Помещение модели';
   preview.replaceChildren(title,text);
   if(priority===2){
    const note=document.createElement('small');
    note.textContent='Рабочая зона по модели';
    preview.append(note);
   }
  }else preview.hidden=true;
  updateHoverCursor();
  orderLabels();
  render();
 }
 function updateHoverCursor(){container.style.cursor=hovered||hoveredFloor?'pointer':'';}
 for(const {button,space,priority} of labels.values()){
  button.classList.toggle('is-pilot',priority===2);
  button.textContent=space.label;
  button.setAttribute('aria-label',`${space.label}${space.displayName?' · '+space.displayName:''}${priority===2?' · Рабочая зона по модели':''}`);
 }
 function refresh(){
  for(const [id,mesh] of roomMeshes){
   mesh.visible=visible.has(id)&&(!focusedRoom||id===focusedRoom);
   const prop=decor.roomProps.get(id);
   if(prop)prop.visible=mesh.visible;
   applyMaterial(id);
   labels.get(id).button.setAttribute('aria-pressed',String(id===selected));
  }
  orderLabels();
  render();
 }
 function viewOrientation(aspect){
  const portrait=aspect<.82;
  const offset=topView
   ?new THREE.Vector3(0,80,.12)
   :isBuilding()
    ?new THREE.Vector3(...(portrait?[-63,52,-56]:[-35,50,-76]))
    :allFloorsVisible()
     ?new THREE.Vector3(...(portrait?[-60,33,-39]:[-29,34,-77]))
     :new THREE.Vector3(...(portrait?[-65,49,-35]:[-26,48,-76]));
  const up=topView?new THREE.Vector3(...(portrait?[1,0,0]:[0,0,-1])):new THREE.Vector3(0,1,0);
  return {offset,up};
 }
 function projectedFrame(points,offset,up,baseTarget,aspect,widthFill,heightFill){
  const normal=offset.clone().normalize();
  const right=new THREE.Vector3().crossVectors(up,normal).normalize();
  const vertical=new THREE.Vector3().crossVectors(normal,right);
  const xs=points.map(point=>point.dot(right)),ys=points.map(point=>point.dot(vertical));
  const left=Math.min(...xs),rightEdge=Math.max(...xs),bottom=Math.min(...ys),top=Math.max(...ys);
  const target=baseTarget.clone()
   .addScaledVector(right,(left+rightEdge)/2-baseTarget.dot(right))
   .addScaledVector(vertical,(bottom+top)/2-baseTarget.dot(vertical));
  const half=Math.max((rightEdge-left)/(2*aspect*widthFill),(top-bottom)/(2*heightFill));
  return {target,half};
 }
 function fit(orientation){
  const aspect=mapWidth/mapHeight;
  const {offset,up}=orientation??(focusedRoom
   ?{offset:new THREE.Vector3(8,12,11),up:new THREE.Vector3(0,1,0)}
   :viewOrientation(aspect));
  let target=new THREE.Vector3(0,view?(view-1)*10:20,0);
  let half;
  if(stairFocus!==null){
   const {bounds}=routeStairs.get(stairFocus);
   target=bounds.center.clone();
   half=Math.max(bounds.radius/aspect,bounds.radius)*1.27;
  }else if(focusedRoom){
   const bounds=new THREE.Box3().setFromObject(catalogModel?.group??decor.roomShowcases.get(focusedRoom));
   const points=[];
   for(const x of [bounds.min.x,bounds.max.x]){
    for(const y of [bounds.min.y,bounds.max.y]){
     for(const z of [bounds.min.z,bounds.max.z])points.push(new THREE.Vector3(x,y,z));
    }
   }
   ({target,half}=projectedFrame(points,offset,up,bounds.getCenter(target),aspect,.72,.69));
  }else{
   const building=isBuilding();
   const gap=targetFloorGap();
   const points=building?buildingPoints:floorLabels.filter(floor=>floorInView(floor.number)).flatMap(floor=>{
    if(!gap)return floor.boundary;
    const shift=new THREE.Vector3(0,(floor.number-1)*gap,0);
    return floor.boundary.map(point=>point.clone().add(shift));
   });
   const mobile=matchMedia('(max-width:700px)').matches;
   const widthFill=mobile?(view||building?.92:.80):.82;
   let heightFill=building?.79:.82;
   if(mobile&&routeGroup){
    // The mobile view and scale toolbar occupies the bottom of the route canvas.
    const usableHeight=Math.max(1,mapHeight-48);
    heightFill*=usableHeight/mapHeight;
   }
   ({target,half}=projectedFrame(points,offset,up,target,aspect,widthFill,heightFill));
   if(mobile&&routeGroup){
    const vertical=up.clone().addScaledVector(offset,-up.dot(offset)/offset.lengthSq()).normalize();
    target.addScaledVector(vertical,-half*48/mapHeight);
   }
  }
  camera.left=-half*aspect;
  camera.right=half*aspect;
  camera.top=half;
  camera.bottom=-half;
  camera.updateProjectionMatrix();
  return {target,offset,up};
 }
 function currentOrientation(){
  return {offset:camera.position.clone().sub(controls.target),up:camera.up};
 }
 function routeVisibility(){
  if(!routeGroup)return;
  routeGroup.visible=!isBuilding()&&!focusedRoom;
  for(const surface of routeSurfaces){
   const {routeFloor,overviewOnly}=surface.userData;
   surface.visible=stairFocus===null&&(!view||view===routeFloor)
    &&(!overviewOnly||(!view&&!topView));
  }
  let shown=0;
  for(const [index,{group,connectorLines,focusHeight}] of routeStairs.entries()){
   group.visible=routeGroup.visible&&!topView&&(stairFocus===null?!view:stairFocus===index);
   for(const line of connectorLines)line.visible=stairFocus===null;
   const compact=stairFocus===index;
   group.scale.y=compact?.38:1;
   group.position.y=compact?focusHeight*.62:0;
   if(group.visible)shown++;
  }
  container.dataset.routeStairs=String(shown);
  const position=sampleRoutePreview(previewPath,previewProgress);
  traveller.visible=stairFocus===null&&Boolean(position&&(!view||position.floor===view));
 }
 function opacity(f,value){
  for(const m of Object.values(f.palette))setMaterialOpacity(m,value*(m.userData.baseOpacity??1));
  f.outlineMaterial.opacity=value;
  f.decor.visible=!topView&&value>=.7;
 }
 async function setView(number,{animate=true,keepPreview=false,stairIndex=null,overview=overviewMode}={}){
  hoverPointer=null;
  previewFloor(null);if(!keepPreview)pausePreview();focusedRoom=null;catalogModel?.dispose();catalogModel=null;controls.maxZoom=16;
  const revision=++viewRevision;
  stairFocus=routeStairs.has(stairIndex)?stairIndex:null;
  if(stairFocus===null)delete container.dataset.stairFocus;
  else container.dataset.stairFocus=String(stairFocus);
  view=stairFocus===null?(Number(number)||0):0;
  overviewMode=overview;
  if(!view)topView=false;
  roomContext();
  container.dataset.floorView=String(view);container.dataset.overview=overviewMode;container.dataset.projection=topView?'plan':'3d';hover(null);
  // In the plan projection low walls must not shade the corridor as long dark bands.
  for(const [,fg] of floorGroups)fg.walls.scale.y=topView?.24:1;transitioning=true;container.setAttribute('aria-busy','true');turnMotion.cancel();motion.cancel();
  const {target,offset,up:toUp}=fit();
  const startShell=shellMix,endShell=isBuilding()?1:0;
  const startGap=floorGap,endGap=targetFloorGap();
  const starts=new Map();
  for(const [n,f] of floorGroups)starts.set(n,f.group.visible?f.palette.plate.opacity:0);
  setShell(startShell);
  routeVisibility();
  const direction=stairFocus===null?offset:routeStairs.get(stairFocus).focusOffset;
  const to=target.clone().add(direction),from=camera.position.clone(),old=controls.target.clone(),zoom=camera.zoom,fromUp=camera.up.clone();controls.enabled=false;
  await motion.run(t=>{
   setShell(startShell+(endShell-startShell)*t,startGap+(endGap-startGap)*t);
   for(const [n,f] of floorGroups){
    const end=floorInView(n)?1:0;
    opacity(f,starts.get(n)+(end-starts.get(n))*t);
   }
   camera.up.lerpVectors(fromUp,toUp,t).normalize();
   camera.position.lerpVectors(from,to,t);
   controls.target.lerpVectors(old,target,t);
   camera.zoom=zoom+(1-zoom)*t;
   camera.updateProjectionMatrix();
   controls.update();
   render();
  },animate?(startShell!==endShell?900:620):0);
  if(revision!==viewRevision||disposed||failed)return;
  setShell(endShell,endGap);
  for(const [n,f] of floorGroups){
   f.group.visible=floorVisible(n);
   opacity(f,1);
  }
  transitioning=false;
  container.setAttribute('aria-busy','false');
  controls.enabled=true;
  controls.enableRotate=!topView;
  routeVisibility();
  render();
 }
 async function focusRoom(id,{reframe=false}={}){
  const entry=campus.entries.get(id);
  if(!entry?.center)return;
  if(reframe||view!==entry.floor||focusedRoom||transitioning){
   const request=setView(entry.floor,{animate:!focusedRoom}),revision=viewRevision;
   await request;
   if(revision!==viewRevision||disposed||failed)return;
  }
  const revision=++viewRevision;
  const bounds=roomBounds(entry.polygon);
  container.dataset.projection=topView?'plan':'3d';
  const p=new THREE.Vector3(...sceneWorld(entry.floor,[bounds.x,bounds.z],.38));
  const start=camera.position.clone(),old=controls.target.clone(),initial=camera.zoom;
  // Fit the actual room, rather than using one zoom for rooms of every size.
  // Measure its corners in camera space so the fit also works after rotation.
  camera.updateMatrixWorld();
  const corners=[];
  for(const x of [bounds.x-bounds.w/2,bounds.x+bounds.w/2])for(const z of [bounds.z-bounds.d/2,bounds.z+bounds.d/2])for(const y of [.02,1.2])corners.push(new THREE.Vector3(...sceneWorld(entry.floor,[x,z],y)).applyMatrix4(camera.matrixWorldInverse));
  const xs=corners.map(c=>c.x),ys=corners.map(c=>c.y);
  const roomWidth=Math.max(.1,Math.max(...xs)-Math.min(...xs));
  const roomHeight=Math.max(.1,Math.max(...ys)-Math.min(...ys));
  const roomZoom=Math.min((camera.right-camera.left)/roomWidth,(camera.top-camera.bottom)/roomHeight);
  const focusZoom=THREE.MathUtils.clamp(roomZoom/2.2,1,5),offset=camera.position.clone().sub(controls.target);
  transitioning=true;container.setAttribute('aria-busy','true');controls.enabled=false;
  const complete=await turnMotion.run(t=>{controls.target.lerpVectors(old,p,t);camera.position.lerpVectors(start,p.clone().add(offset),t);camera.zoom=initial+(focusZoom-initial)*t;camera.updateProjectionMatrix();controls.update();render();},440);
  if(!complete||revision!==viewRevision||disposed||failed)return;transitioning=false;container.setAttribute('aria-busy','false');controls.enabled=true;render();
 }
 function showInterior(id,room){
  if(routeGroup||id!==selected||(!room&&!decor.roomShowcases.has(id)))return false;
  settle();
  hover(null);
  topView=false;
  const nextId=id??room.id;
  const replacing=Boolean(room&&catalogModel&&focusedRoom===nextId);
  const orientation=replacing?currentOrientation():null;
  const oldCenter=replacing?fit(orientation).target:null;
  catalogModel?.dispose();
  catalogModel=null;
  if(room){
   const polygon=campus.entries.get(id)?.polygon;
   catalogModel=createCatalogModel(THREE,room,polygon&&roomBounds(polygon));
   catalogModel.group.position.y=30;
   scene.add(catalogModel.group);
  }
  focusedRoom=nextId;
  setShell(0);
  roomContext();
  for(const [,floor] of floorGroups)floor.walls.scale.y=1;
  container.dataset.projection='3d';
  if(replacing){
   const shift=fit(orientation).target.sub(oldCenter);
   controls.target.add(shift);
   camera.position.add(shift);
   controls.update();
   render();
  }else frameInterior();
  return true;
 }
 function frameInterior(){
  const {target,offset,up}=fit();
  camera.up.copy(up);
  camera.position.copy(target).add(offset);
  camera.zoom=1;
  camera.updateProjectionMatrix();
  controls.target.copy(target);
  controls.enableRotate=true;
  controls.update();
  render();
 }
 function clearRoute(){
  pausePreview();
  if(routeGroup){
   const geometries=new Set(),routeMaterials=new Set();
   routeGroup.traverse(object=>{
    if(object.isInstancedMesh)object.dispose();
    if(object.geometry&&object.geometry!==box)geometries.add(object.geometry);
    if(object.material)routeMaterials.add(object.material);
   });
   geometries.forEach(geometry=>geometry.dispose());
   routeMaterials.forEach(material=>material.dispose());
   scene.remove(routeGroup);
  }
  routeGroup=null;traveller=null;previewPath=null;previewProgress=0;stairFocus=null;
  for(const endpoint of routeEndpoints)endpoint.label.remove();routeEndpoints.length=0;
  routeSurfaces.length=0;routeStairs.clear();routeFloors.clear();
  delete container.dataset.stairFocus;
  container.dataset.routeStairs='0';
 }
 function routeMaterial(color){return new THREE.MeshBasicMaterial({color,depthTest:false,depthWrite:false,transparent:true,toneMapped:false});}
 function routeLine(a,b,radius,group,color=0x0064cf){const length=a.distanceTo(b);if(length<.001)return;const mesh=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,length,8),routeMaterial(color));mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());mesh.renderOrder=10;group.add(mesh);}
 function addRouteSurface(object,floor){
  object.userData.routeFloor=floor;
  routeSurfaces.push(object);
  routeGroup.add(object);
 }
 function addRouteMarker(floor,point,color){
  const marker=new THREE.Mesh(new THREE.TorusGeometry(.42,.1,8,20),routeMaterial(color));
  marker.rotation.x=Math.PI/2;
  marker.position.set(...sceneWorld(floor,point,.28));
  marker.renderOrder=12;
  addRouteSurface(marker,floor);
 }
 function addRouteEndpoint(floor,point,title,color){
  const position=new THREE.Vector3(...sceneWorld(floor,point,.34));
  const group=new THREE.Group();group.position.copy(position);
  const outer=new THREE.Mesh(new THREE.CylinderGeometry(.62,.62,.11,24),routeMaterial(0xf5f0e5));outer.renderOrder=12;group.add(outer);
  const inner=new THREE.Mesh(new THREE.CylinderGeometry(.41,.41,.13,24),routeMaterial(color));inner.position.y=.07;inner.renderOrder=13;group.add(inner);
  addRouteSurface(group,floor);
  const label=document.createElement('span');label.textContent=title;label.setAttribute('aria-hidden','true');
  Object.assign(label.style,{position:'absolute',transform:'translate(-50%,-100%)',background:'#f5f0e5',color:'#263d53',borderRadius:'5px',padding:'3px 7px',font:'600 11px/1.3 sans-serif',whiteSpace:'nowrap',border:'1px solid #d1d5c9',pointerEvents:'none'});
  labelLayer.append(label);routeEndpoints.push({label,position,floor});
 }
 function addRoutePath(points,group){
  const spans=[];for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],length=a.distanceTo(b);if(length>.001)spans.push({a,b,length});}
  if(!spans.length)return;
  const transform=new THREE.Object3D(),up=new THREE.Vector3(0,1,0);
  // The pale casing separates the route from the busy model without hiding its shape.
  for(const [radius,color,order] of [[.23,0xffffff,9],[.13,0x0064cf,10]]){
   const mesh=new THREE.InstancedMesh(new THREE.CylinderGeometry(radius,radius,1,8),routeMaterial(color),spans.length);
   for(const [index,{a,b,length}] of spans.entries()){transform.position.copy(a).add(b).multiplyScalar(.5);transform.scale.set(1,length,1);transform.quaternion.setFromUnitVectors(up,b.clone().sub(a).normalize());transform.updateMatrix();mesh.setMatrixAt(index,transform.matrix);}
   mesh.instanceMatrix.needsUpdate=true;mesh.renderOrder=order;group.add(mesh);
   // Rounded joins keep a continuous, readable line at every change of direction.
   const joins=new THREE.InstancedMesh(new THREE.SphereGeometry(radius,8,6),routeMaterial(color),spans.length+1);
   transform.quaternion.identity();transform.scale.setScalar(1);
   [spans[0].a,...spans.map(span=>span.b)].forEach((point,index)=>{transform.position.copy(point);transform.updateMatrix();joins.setMatrixAt(index,transform.matrix);});
   joins.instanceMatrix.needsUpdate=true;joins.renderOrder=order;group.add(joins);
  }
 }
 function addRouteStair(index,connection,stair,stepMaterial,landingMaterial){
  const group=new THREE.Group();
  const transform=new THREE.Object3D();
  const rise=Math.abs((stair.treads[1]?.position[1]??0)-(stair.treads[0]?.position[1]??0));
  for(const [boxes,material] of [[stair.treads,stepMaterial],[stair.landings,landingMaterial]]){
   if(!boxes.length)continue;
   const mesh=new THREE.InstancedMesh(box,material,boxes.length);
   for(const [index,part] of boxes.entries()){
    transform.position.set(...part.position);
    transform.scale.set(...part.size);
    // Keep the tread surface and route elevation fixed while filling the riser.
    if(boxes===stair.treads&&rise>part.size[1]){
     transform.position.y-=(rise-part.size[1])/2;
     transform.scale.y=rise;
    }
    transform.rotation.y=part.rotationY;
    transform.updateMatrix();
    mesh.setMatrixAt(index,transform.matrix);
   }
   mesh.instanceMatrix.needsUpdate=true;
   group.add(mesh);
  }
  const boundsBox=new THREE.Box3().setFromObject(group),focusHeight=(Math.min(connection.fromFloor,connection.toFloor)-1)*10+.18;
  boundsBox.min.y=focusHeight+(boundsBox.min.y-focusHeight)*.38;
  boundsBox.max.y=focusHeight+(boundsBox.max.y-focusHeight)*.38;
  const bounds=boundsBox.getBoundingSphere(new THREE.Sphere());
  const angle=stair.treads[0]?.rotationY??0;
  const focusOffset=new THREE.Vector3(-68,62,-36).applyAxisAngle(new THREE.Vector3(0,1,0),angle);
  const raised=point=>new THREE.Vector3(point[0],point[1]+.09,point[2]);
  const spans=[];
  const connectors=stair.connectors??(stair.connector?[stair.connector]:[]),connectorLines=[];
  for(let i=1;i<stair.path.length;i++){
   const from=stair.path[i-1],to=stair.path[i];
   if(connectors.some(([a,b])=>a===from&&b===to)){
    const geometry=new THREE.BufferGeometry().setFromPoints([raised(from),raised(to)]);
    const material=new THREE.LineDashedMaterial({color:0x896742,dashSize:.38,gapSize:.24,depthTest:false,depthWrite:false,transparent:true});
    const connector=new THREE.Line(geometry,material);
    connector.computeLineDistances();
    connector.renderOrder=11;
    group.add(connector);
    connectorLines.push(connector);
    continue;
   }
   if(from.some((value,index)=>Math.abs(value-to[index])>1e-4))spans.push([raised(from),raised(to)]);
  }
  if(spans.length){
   const up=new THREE.Vector3(0,1,0),direction=new THREE.Vector3();
   const radius=Math.min(.09,(stair.treads[0]?.size[0]??1)*.12);
   const mesh=new THREE.InstancedMesh(new THREE.CylinderGeometry(radius,radius,1,8),routeMaterial(0x0064cf),spans.length);
   for(const [index,[from,to]] of spans.entries()){
    direction.subVectors(to,from);
    transform.position.copy(from).add(to).multiplyScalar(.5);
    transform.scale.set(1,direction.length(),1);
    transform.quaternion.setFromUnitVectors(up,direction.normalize());
    transform.updateMatrix();
    mesh.setMatrixAt(index,transform.matrix);
   }
   mesh.instanceMatrix.needsUpdate=true;
   mesh.renderOrder=10;
   group.add(mesh);
  }
  const {fromFloor,toFloor,from,to}=connection;
  addRouteMarker(fromFloor,from,0x896742);
  addRouteMarker(toFloor,to,0x896742);
  const landings=[stair.landings[0],stair.landings.at(-1)].flatMap((part,index)=>part
   ?[{position:new THREE.Vector3(...part.position),floor:index===0?Math.min(fromFloor,toFloor):Math.max(fromFloor,toFloor)}]
   :[]);
  routeStairs.set(index,{group,bounds,connectorLines,landings,focusHeight,focusOffset});
  routeGroup.add(group);
 }
 function setRoute(route){
  if(!route&&!routeGroup)return;
  if(route&&focusedRoom){
   focusedRoom=null;
   catalogModel?.dispose();
   catalogModel=null;
   roomContext();
  }
  const wasStairFocused=stairFocus!==null;
  clearRoute();
  if(route)route.floors.forEach(floor=>routeFloors.add(floor));
  overviewMode=route?'spread':'building';
  showWorld();
  if(!route){
   if(wasStairFocused)setView(view,{animate:false});
   else render();
   return;
  }
  routeGroup=new THREE.Group();
  scene.add(routeGroup);
  for(const segment of route.segments){
   const group=new THREE.Group();
   addRouteSurface(group,segment.floor);
   addRoutePath(segment.points.map(point=>new THREE.Vector3(...sceneWorld(segment.floor,point,.18))),group);
  }
  const sameEndpoint=route.from.floor===route.to.floor&&route.from.point.every((value,index)=>Math.abs(value-route.to.point[index])<1e-6);
  addRouteEndpoint(route.from.floor,route.from.point,sameEndpoint?'Начало / цель':'Начало',0x3c514a);
  if(!sameEndpoint)addRouteEndpoint(route.to.floor,route.to.point,'Цель',0x0064cf);
  const stairs=new Map();
  if(route.connections.length){
   let stepMaterial,landingMaterial;
   for(const [index,connection] of route.connections.entries()){
    if(connection.kind==='lift'){
     const {fromFloor,toFloor,from,to}=connection;
     const group=new THREE.Group();
     group.userData.overviewOnly=true;
     addRouteSurface(group,fromFloor);
     routeLine(new THREE.Vector3(...sceneWorld(fromFloor,from,.27)),new THREE.Vector3(...sceneWorld(toFloor,to,.27)),.18,group,0x896742);
     addRouteMarker(fromFloor,from,0x896742);
     addRouteMarker(toFloor,to,0x896742);
     continue;
    }
    const ascending=connection.fromFloor<connection.toFloor;
    const floor=ascending?connection.fromFloor:connection.toFloor;
    const stairIndex=ascending?connection.stair:connection.toStair;
    const layout=stairDisplay(campus.floors.get(floor).source,stairIndex,display.get(floor).point);
    const stair=buildRouteStair(connection,sceneWorld,layout);
    stepMaterial??=new THREE.MeshStandardMaterial({color:0xa88764,roughness:.75});
    landingMaterial??=new THREE.MeshStandardMaterial({color:0xc8aa89,roughness:.65});
    stairs.set(connection,stair);
    addRouteStair(index,connection,stair,stepMaterial,landingMaterial);
   }
  }
  previewPath=createRoutePreview(route,sceneWorld,connection=>stairs.get(connection)?.path.map(([x,y,z])=>[x,y+.09,z]));
  traveller=new THREE.Mesh(new THREE.SphereGeometry(.34,16,12),routeMaterial(0x253c33));
  traveller.renderOrder=15;
  routeGroup.add(traveller);
  setPreview(0);
 }
 function reportPreview(){const sample=sampleRoutePreview(previewPath,previewProgress);onPreview({playing,progress:previewProgress,floor:sample?.floor,step:sample?.step,toFloor:sample?.toFloor,connection:sample?.connection,done:previewProgress>=1});}
 function setPreview(progress){previewProgress=Math.max(0,Math.min(1,Number(progress)||0));const p=sampleRoutePreview(previewPath,previewProgress);if(traveller&&p)traveller.position.set(...p.position);routeVisibility();reportPreview();render();}
 function pausePreview(){playing=false;if(previewFrame!==null)cancelAnimationFrame(previewFrame);previewFrame=null;previewTime=null;reportPreview();}
 function playPreview(){
  if(!previewPath||!previewPath.length)return;if(playing){pausePreview();return;}
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){setPreview(previewProgress>=1?0:Math.min(1,previewProgress+.2));return;}
  if(previewProgress>=1)setPreview(0);playing=true;previewTime=null;setView(0,{keepPreview:true});reportPreview();
  const duration=Math.max(8000,Math.min(24000,previewPath.length*170));
  function tick(time){if(!playing||disposed||failed||document.hidden){pausePreview();return;}if(previewTime!==null)setPreview(previewProgress+(time-previewTime)/duration);previewTime=time;if(previewProgress>=1){pausePreview();return;}previewFrame=requestAnimationFrame(tick);}
  previewFrame=requestAnimationFrame(tick);
 }
 function settle(){previewFloor(null);viewRevision++;motion.cancel();turnMotion.cancel();transitioning=false;container.setAttribute('aria-busy','false');controls.enabled=true;controls.enableRotate=!topView;setShell(isBuilding()?1:0,targetFloorGap());for(const [n,f] of floorGroups){f.group.visible=floorVisible(n);opacity(f,1);}render();}
 function resize(){
  const width=container.clientWidth,height=container.clientHeight;
  if(!width||!height||width===mapWidth&&height===mapHeight)return;
  const portrait=width/height<.82;
  const reframe=portrait!==portraitState&&!transitioning&&!focusedRoom&&!selected;
  const orientation=!reframe&&!transitioning?currentOrientation():null;
  const oldCenter=orientation?fit(orientation).target:null;
  mapWidth=width;
  mapHeight=height;
  portraitState=portrait;
  const pixelRatio=Math.min(devicePixelRatio||1,1.5,Math.sqrt(maxRenderPixels/(width*height)));
  if(renderer.getPixelRatio()!==pixelRatio)renderer.setPixelRatio(pixelRatio);
  renderer.setSize(width,height,false);
  if(reframe){
   setView(view,{animate:false,stairIndex:stairFocus});
   return;
  }
  const frame=fit(orientation);
  if(oldCenter){
   const shift=frame.target.sub(oldCenter);
   controls.target.add(shift);
   camera.position.add(shift);
   controls.update();
  }
  render();
 }
 const observer=new ResizeObserver(resize);observer.observe(container);controls.addEventListener('change',render);
 controls.addEventListener('start',()=>{pausePreview();settle();hover(null);});
 const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();
 const buildingTargets=[...exterior.facades.values(),exterior.roof];
 function hitObject({clientX,clientY},{includeRooms=false}={}){
  if(stairFocus!==null||focusedRoom)return null;
  const r=renderer.domElement.getBoundingClientRect();
  if(!r.width||!r.height)return null;
  pointer.set((clientX-r.left)/r.width*2-1,1-(clientY-r.top)/r.height*2);
  camera.updateMatrixWorld();
  scene.updateMatrixWorld();
  ray.setFromCamera(pointer,camera);
  if(isBuilding()){
   for(const {object} of ray.intersectObjects(buildingTargets,true)){
    let owner=object;
    while(owner&&!owner.userData.floor)owner=owner.parent;
    if(owner)return owner;
   }
   return null;
  }
  const overview=allFloorsVisible();
  const targets=overview?[...floorGroups.values()].filter(floor=>floor.group.visible).map(floor=>floor.plate):[];
  if(!overview||includeRooms){
   for(const mesh of roomMeshes.values())if(mesh.visible&&mesh.parent.visible)targets.push(mesh);
  }
  return ray.intersectObjects(targets,false)[0]?.object||null;
 }
 function movedSinceDown(event){return Math.hypot(event.clientX-down.x,event.clientY-down.y)>=5;}
 const surface=renderer.domElement;
 surface.addEventListener('pointermove',event=>{
  if(down){
   if(event.pointerId===down.id&&movedSinceDown(event))down.moved=true;
   return;
  }
  if(event.pointerType==='touch'||event.buttons||transitioning)return;
  hoverPointer=event;
  render();
 });
 surface.addEventListener('pointerleave',()=>{
  hoverPointer=null;
  hover(null);
  previewFloor(null);
 });
 surface.addEventListener('pointerdown',event=>{
  if(down){down.moved=true;return;}
  if(!event.isPrimary||event.button!==0)return;
  hoverPointer=null;
  previewFloor(null);
  pausePreview();
  if(transitioning)settle();
  turnMotion.cancel();
  hover(null);
  down={id:event.pointerId,x:event.clientX,y:event.clientY,moved:false};
 });
 surface.addEventListener('pointerup',event=>{
  if(down?.id!==event.pointerId)return;
  const activate=!down.moved&&!movedSinceDown(event);
  down=null;
  if(!activate)return;
  const hit=hitObject(event);
  if(hit?.userData.floor)onFloor(hit.userData.floor);
  else if(hit?.userData.spaceId)onSelect(hit.userData.spaceId);
 });
 function cancelPointer(event){if(down?.id===event.pointerId)down=null;}
 surface.addEventListener('pointercancel',cancelPointer);
 surface.addEventListener('lostpointercapture',cancelPointer);
 const visibility=()=>{
  if(document.hidden){
   hoverPointer=null;
   down=null;
   hover(null);
   pausePreview();
   settle();
   stopRendering();
  }else render();
 };
 document.addEventListener('visibilitychange',visibility);
 renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();failed=true;stopRendering();pausePreview();motion.cancel();turnMotion.cancel();onFailure();});refresh();resize();
 return {setView,previewFloor,focusRoom,showInterior,setRoute,playPreview,pausePreview,seekPreview(value){pausePreview();setPreview(value);},setVisible(ids){visible=new Set(ids);if(hovered&&!visible.has(hovered))hover(null);refresh();},setRoomCatalog(rooms){furniture.setRoomCatalog(rooms);render();},select(id,{focus=true}={}){const leaving=!id&&focusedRoom;selected=id;refresh();if(leaving)setView(view);else if(id&&focus)focusRoom(id);},
  setProjection(plan){
   if(stairFocus!==null)return;
   topView=Boolean(plan);
   if(selected&&!routeGroup&&labels.has(selected))focusRoom(selected,{reframe:true});
   else setView(view);
  },
  rotate(){if(topView)return;pausePreview();settle();const offset=camera.position.clone().sub(controls.target),from=Math.atan2(offset.x,offset.z),radius=Math.hypot(offset.x,offset.z);turnMotion.run(t=>{const angle=from+Math.PI/2*t;camera.position.set(controls.target.x+Math.sin(angle)*radius,camera.position.y,controls.target.z+Math.cos(angle)*radius);controls.update();render();},450);},
  zoom(factor){pausePreview();settle();camera.zoom=THREE.MathUtils.clamp(camera.zoom*factor,controls.minZoom,controls.maxZoom);camera.updateProjectionMatrix();render();},
  pan(x,y){
   pausePreview();
   settle();
   camera.updateMatrixWorld();
   const distance=(camera.top-camera.bottom)/camera.zoom/mapHeight;
   const move=new THREE.Vector3().setFromMatrixColumn(camera.matrix,0).multiplyScalar(x*distance);
   move.addScaledVector(projectedPosition.setFromMatrixColumn(camera.matrix,1),y*distance);
   camera.position.add(move);
   controls.target.add(move);
   controls.update();
   render();
  },
  reset(){if(focusedRoom){settle();frameInterior();}else if(selected&&!routeGroup&&labels.has(selected))focusRoom(selected,{reframe:true});else setView(view,{stairIndex:stairFocus});},
  get view(){return view;},
  dispose(){disposed=true;stopRendering();pausePreview();motion.cancel();turnMotion.cancel();document.removeEventListener('visibilitychange',visibility);observer.disconnect();controls.dispose();clearRoute();catalogModel?.dispose();exterior.dispose();decor.dispose();furniture.dispose();floorGroups.forEach(f=>{f.walls.dispose();f.envelope.dispose();f.stairs.forEach(mesh=>mesh.dispose());});resources.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());stairTags.forEach(tag=>tag.remove());labelLayer.remove();preview.remove();renderer.dispose();renderer.domElement.remove();}
 };
}
