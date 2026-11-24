import * as THREE from 'three';
import {contactShadowSize,makeContactShadow} from './contact-shadow.js';
import {createComputerStickerSurface} from './computer-stickers.js?v=20261124-room-style';
import {mergeGeometries} from '../vendor/BufferGeometryUtils.js';
import {pilotRoomBySpace} from './pilot-spaces.js?v=20261113-navigation';
// A deliberately authored campus maquette, not a survey of current interiors.
export function createMaquetteProps({campus,box,material,track,textures}){
 const white=material({color:0xf0e9dc,roughness:.82});
 const wood=material({color:0xb88760,roughness:.78});
 const ink=material({color:0x29383c,roughness:.65});
 const leaf=material({color:0x597b67,roughness:.95});
 const coral=material({color:0xb76f56,roughness:.89});
 const glass=material({color:0x7f9fa9,metalness:.18,roughness:.46});
 const plaster=material({color:0xe9dec6,roughness:1});
 const concrete=material({color:0x928e80,roughness:.92});
 const roomPlaster=material({color:0xd3d2ca,roughness:.95});
 const roomFloor=material({color:0x9a9b93,roughness:.88});
 const laminate=material({color:0xe2e3de,roughness:.78});
 const panel=material({color:0xc4c7c4,roughness:.78});
 const showcaseShadow=track(new THREE.PlaneGeometry(1,1));
 showcaseShadow.rotateX(-Math.PI/2);
 const shadowMap=new THREE.DataTexture(makeContactShadow(),contactShadowSize,contactShadowSize,THREE.RGBAFormat);
 shadowMap.magFilter=shadowMap.minFilter=THREE.LinearFilter;
 shadowMap.needsUpdate=true;
 textures.add(shadowMap);
 const shade=material({map:shadowMap,transparent:true,depthWrite:false,roughness:1});
 const seatPart=cushionGeometry(.63,.55,.08);
 seatPart.rotateX(-Math.PI/2);
 seatPart.translate(0,.32,0);
 const backPart=cushionGeometry(.61,.40,.045);
 backPart.rotateX(-.14);
 backPart.translate(0,.56,-.245);
 const chairGeometry=track(mergeGeometries([seatPart,backPart]));
 seatPart.dispose();
 backPart.dispose();
 const cylinder=track(new THREE.CylinderGeometry(1,1,1,12)),sphere=track(new THREE.SphereGeometry(1,12,8)),batches=new Map(),roomProps=new Map();
 const deskHeight=.72;
 function primitive(parent,geo,mat,x,y,z,w,h,d,ry=0){let map=batches.get(parent);if(!map){map=new Map();batches.set(parent,map);}const key=geo.uuid+mat.uuid;if(!map.has(key))map.set(key,{geo,mat,items:[]});map.get(key).items.push({x,y,z,w,h,d,ry});}
 const b=(p,m,x,y,z,w,h,d,ry=0)=>primitive(p,box,m,x,y,z,w,h,d,ry);
 const c=(p,m,x,y,z,w,h,d)=>primitive(p,cylinder,m,x,y,z,w,h,d);
 const ball=(p,m,x,y,z,w,h,d)=>primitive(p,sphere,m,x,y,z,w,h,d);
 function plant(p,x,z,s=.3){c(p,coral,x,s*.22,z,s*.3,s*.44,s*.3);c(p,ink,x,s*.7,z,.025,s,.025);for(const [dx,dz] of [[0,0],[.13,.04],[-.12,-.02]])ball(p,leaf,x+dx*s,s*1.05,z+dz*s,s*.3,s*.4,s*.23);}
 function shelf(p,x,z,w,h=.75){b(p,wood,x,h/2,z,w,h,.12);for(let i=0;i<3;i++){b(p,ink,x,.13+i*.21,z+.075,w,.025,.04);for(let j=0;j<5;j++)b(p,j%2?white:coral,x-w*.38+j*w*.18,.22+i*.21,z+.095,w*.1,.15,.07);}}
 function poster(p,x,z,w,h=.65){b(p,ink,x,h/2+.18,z,w+.04,h+.04,.035);b(p,white,x,h/2+.18,z+.025,w,h,.015);b(p,coral,x-w*.12,h*.62+.18,z+.04,w*.5,h*.18,.01);b(p,glass,x+w*.17,h*.28+.18,z+.04,w*.22,h*.27,.01);}
 function chair(parent,x,z,size,angle,roomId){
  const group=new THREE.Group();
  group.position.set(x,0,z);
  group.rotation.y=angle;
  parent.add(group);
  primitive(group,chairGeometry,panel,0,0,0,size,size,size);
  c(group,ink,0,size*.21,0,size*.045,size*.34,size*.045);
  for(const rotation of [0,Math.PI/3,-Math.PI/3]){
   b(group,ink,0,size*.055,0,size*.56,size*.05,size*.055,rotation);
  }
  if(roomId==='f4-s36')for(const x of [-size*.4,size*.4])b(group,coral,x,size*.5,0,size*.13,size*.28,size*.7);
 }
 function monitor(parent,x,z,angle){
  const group=new THREE.Group();
  group.position.set(x,deskHeight,z);
  group.rotation.y=angle;
  parent.add(group);
  b(group,ink,0,.025,.16,.29,.025,.22);
  b(group,ink,0,.18,.23,.065,.32,.065);
  b(group,ink,0,.39,.24,.66,.40,.045);
  b(group,glass,0,.40,.214,.60,.345,.008);
  b(group,leaf,-.12,.40,.206,.25,.19,.005);
  b(group,white,.12,.32,.205,.16,.018,.005);
  b(group,white,0,.022,-.11,.43,.026,.14);
  b(group,ink,.33,.023,-.10,.09,.045,.12);
  b(group,ink,.445,.168,.205,.126,.33,.30);
  const p=group.localToWorld(new THREE.Vector3(.445,.184,.053));
  return [p.x,p.y,p.z,.102,.034,angle+Math.PI];
 }
 function taskLamp(parent,x,z){
  c(parent,ink,x,deskHeight+.025,z,.11,.023,.11);
  c(parent,ink,x,deskHeight+.21,z,.017,.39,.017);
  b(parent,ink,x-.12,deskHeight+.40,z,.26,.024,.024);
  c(parent,plaster,x-.24,deskHeight+.35,z,.13,.095,.13);
 }
 function workSurface(parent,x,z,width,depth){
  primitive(parent,showcaseShadow,shade,x,.012,z,width*1.18,1,depth*2.25);
  b(parent,laminate,x,deskHeight,z,width,.055,depth);
  for(const side of [-1,1]){
   const leg=x+side*(width/2-.12);
   b(parent,ink,leg,deskHeight/2,z-depth*.35,.055,deskHeight,.055);
   b(parent,ink,leg,deskHeight/2,z+depth*.35,.055,deskHeight,.055);
   b(parent,ink,leg,.11,z,.055,.055,depth*.71);
  }
 }
 function storage(parent,x,z,width){
  b(parent,panel,x,.4,z,width,.8,.42);
  b(parent,laminate,x,.81,z,width+.035,.035,.455);
  for(const side of [-1,1]){
   b(parent,white,x+side*width/4,.43,z+.22,width*.47,.63,.027);
   b(parent,ink,x+side*.07,.49,z+.245,.032,.105,.024);
  }
 }
 function showcaseShell(parent){
  b(parent,concrete,0,-.235,0,8.44,.24,7.44);
  b(parent,ink,0,-.102,0,8.46,.037,7.46);
  b(parent,roomFloor,0,-.04,0,8.38,.082,7.38);
  for(let line=-8;line<=8;line++)b(parent,concrete,line*.48,.002,0,.007,.002,7.38);
  for(let line=-7;line<=7;line++)b(parent,concrete,0,.002,line*.48,8.38,.002,.007);
  // Tall back wall and low side cuts keep the view open from either aisle.
  b(parent,roomPlaster,0,.32,-3.52,8.26,.64,.16);
  b(parent,roomPlaster,0,1.69,-3.52,8.26,.28,.16);
  for(const x of [-3.97,-1.43,1.43,3.97]){
   b(parent,roomPlaster,x,1.08,-3.52,.29,1.16,.16);
  }
  for(const x of [-2.7,0,2.7]){
   const width=x===0?2.57:2.25;
   b(parent,laminate,x,.68,-3.50,width,.085,.32);
   b(parent,ink,x,1.095,-3.47,.058,.80,.065);
   b(parent,ink,x,1.20,-3.47,width,.045,.065);
   b(parent,glass,x-.31,1.09,-3.53,width*.27,.77,.023);
  }
  for(const x of [-4.04,4.04]){
   b(parent,roomPlaster,x,.24,-.55,.16,.48,5.80);
   b(parent,laminate,x,.492,-.55,.18,.024,5.82);
   b(parent,ink,x,.04,-.55,.17,.075,5.79);
  }
 }
 function computerLab(parent,room){
  const paired=room.spaceId==='f4-s13';
  const stickers=[];
  for(const z of [-1.30,1.30]){
   if(paired){
    for(const x of [-1.62,1.62])workSurface(parent,x,z,2.62,.92);
   }else{
    workSurface(parent,0,z,6.35,.92);
   }
   const angle=z<0?Math.PI:0;
   for(const x of [-2.34,-.78,.78,2.34]){
    stickers.push(monitor(parent,x,z,angle));
    chair(parent,x,z-Math.cos(angle)*.80,1,angle,room.spaceId);
    if(room.spaceId==='f4-s8')b(parent,coral,x-.48,deskHeight+.02,z,.25,.025,.30,.18);
   }
  }
  const surface=createComputerStickerSurface(THREE,room.number,stickers);
  if(surface){
   textures.add(surface.texture);
   const stickerMaterial=material({map:surface.texture,toneMapped:false},THREE.MeshBasicMaterial);
   const stickerMesh=new THREE.Mesh(track(surface.geometry),stickerMaterial);
   stickerMesh.name='computer-stickers';
   parent.add(stickerMesh);
  }
  storage(parent,-2.37,-2.96,2.04);
  if(room.spaceId==='f4-s8'){
   c(parent,white,1.46,.30,-2.96,.30,.60,.30);
   ball(parent,coral,1.46,.83,-2.96,.19,.27,.18);
   c(parent,wood,2.37,.30,-2.96,.24,.60,.24);
   ball(parent,leaf,2.37,.78,-2.96,.14,.22,.13);
  }else if(paired){
   storage(parent,0,-2.96,1.88);
   storage(parent,2.38,-2.96,1.88);
  }else if(room.spaceId==='f4-s20'){
   b(parent,ink,1.83,1.19,-3.11,3.15,1.18,.052);
   b(parent,white,1.83,1.19,-3.079,2.99,1.03,.014);
   b(parent,leaf,1.16,1.19,-3.069,1.32,.66,.012);
   b(parent,glass,2.56,1.34,-3.069,.94,.35,.012);
   b(parent,coral,2.32,.89,-3.069,.45,.1,.012);
   for(const x of [.36,3.30])b(parent,ink,x,.31,-3.10,.06,.62,.06);
  }else{
   workSurface(parent,2.28,-2.90,2.25,.59);
   poster(parent,2.25,-3.32,1.75,.74);
  }
 }
 function lectureRoom(parent,roomId){
  for(const z of [-.42,1.42]){
   workSurface(parent,0,z,5.7,.64);
   for(const x of [-2.12,-.71,.71,2.12]){
    chair(parent,x,z+.57,.96,Math.PI,roomId);
    b(parent,white,x-.08,deskHeight+.035,z,.28,.018,.26);
   }
  }
  workSurface(parent,-1.65,-2.28,1.38,.66);
  b(parent,ink,.62,1.14,-2.72,2.96,1.34,.065);
  b(parent,white,.62,1.14,-2.675,2.83,1.21,.016);
  b(parent,leaf,.12,1.18,-2.662,.85,.46,.012);
  b(parent,concrete,1.13,.97,-2.662,.66,.052,.009);
  for(const x of [-.73,1.95])b(parent,ink,x,.30,-2.69,.065,.60,.065);
 }
 function studyRoom(parent,room){
  const reading=room.style==='reading';
  for(const z of [-1.24,1.24]){
   workSurface(parent,0,z,6.44,.88);
   for(const x of [-2.34,-.78,.78,2.34]){
    const angle=z<0?Math.PI:0;
    chair(parent,x,z-Math.cos(angle)*.82,.99,angle,room.spaceId);
    taskLamp(parent,x+.40,z);
    b(parent,white,x-.12,deskHeight+.039,z-.06,.29,.022,.36,.18);
    if(!reading)b(parent,leaf,x,1.03,z+Math.cos(angle)*.37,1.19,.53,.035);
   }
  }
  if(reading){
   shelf(parent,-2.25,-2.96,2.42,.78);
   shelf(parent,.03,-2.96,1.80,.76);
   shelf(parent,2.24,-2.96,2.10,.80);
  }else{
   storage(parent,0,-2.96,2.40);
  }
 }
 function teamRoom(parent,roomId){
  for(const x of [-1.65,1.65]){
   workSurface(parent,x,0,2.35,1.36);
   for(const z of [-1.08,1.08])for(const offset of [-.52,.52]){
    chair(parent,x+offset,z,1,z<0?0:Math.PI,roomId);
    b(parent,white,x+offset,deskHeight+.041,z*.45,.34,.018,.39,z*.11);
   }
  }
  primitive(parent,showcaseShadow,shade,0,.012,-2.66,5.15,1,1.55);
  b(parent,leaf,0,.27,-2.66,4.55,.48,.73);
  b(parent,leaf,0,.63,-2.98,4.55,.25,.13);
  for(const x of [-2,2])b(parent,wood,x,.065,-2.63,.13,.13,.65);
 }
 function roomShowcase(room){
  const root=new THREE.Group();
  root.userData.spaceId=room.spaceId;
  showcaseShell(root);
  if(room.style==='lecture')lectureRoom(root,room.spaceId);
  else if(room.style==='team')teamRoom(root,room.spaceId);
  else if(room.style==='quiet'||room.style==='reading')studyRoom(root,room);
  else computerLab(root,room);
  plant(root,3.41,-2.89,.54);
  return root;
 }
 // One texture atlas per floor keeps every door number crisp without loading
 // an image per room. Placards follow the same room visibility as the furniture.
 function addWayfinding(root,f,n){
  const doors=f.layout?.doors||[];if(!doors.length||typeof document==='undefined')return;
  const canvas=document.createElement('canvas'),cols=8,rows=Math.ceil((f.spaces.length+1)/cols);canvas.width=1024;canvas.height=rows*64;
  const ctx=canvas.getContext('2d'),indices=new Map();if(!ctx)return;
  ctx.textAlign='center';ctx.textBaseline='middle';
  const entries=[{id:'floor',label:String(n)},...f.spaces];
  entries.forEach((space,i)=>{
   indices.set(space.id,i);
   const x=i%cols*128,y=Math.floor(i/cols)*64;
   const pilot=pilotRoomBySpace(space.id);
   ctx.fillStyle=pilot?'#d7e0d0':'#314b40';
   ctx.fillRect(x,y,128,64);
   ctx.fillStyle=pilot?'#253e32':'#f9f3e6';
   ctx.font='600 '+(String(space.label).length>7?'20':'28')+'px sans-serif';
   ctx.fillText(space.label,x+64,y+33,110);
  });
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;textures.add(texture);const signMaterial=material({map:texture,roughness:.85,side:THREE.DoubleSide});
  function sign(parent,id,w,h){const i=indices.get(id);if(i===undefined)return null;const geo=new THREE.PlaneGeometry(w,h),uv=geo.attributes.uv;for(let j=0;j<uv.count;j++)uv.setXY(j,(i%cols+uv.getX(j))/cols,1-(Math.floor(i/cols)+1-uv.getY(j))/rows);track(geo);const mesh=new THREE.Mesh(geo,signMaterial);parent.add(mesh);return mesh;}
  const numbered=new Set();for(const door of doors){const room=f.spaces.find(s=>s.id===door.id),p=roomProps.get(door.id);if(!room||!p)continue;const g=new THREE.Group();g.position.set(door.position[0]-p.position.x,-.10,door.position[1]-p.position.z);g.rotation.y=-Math.atan2(door.tangent[1],door.tangent[0]);p.add(g);const width=door.width,accent=pilotRoomBySpace(room.id)?leaf:wood;
   // Short reveals describe the opening while keeping the cutaway readable.
   for(const side of [-1,1])b(g,white,side*(width/2+.035),.39,0,.055,.78,.10);b(g,white,0,.79,0,width+.13,.055,.10);
   const leafGroup=new THREE.Group();leafGroup.position.x=-width/2;leafGroup.rotation.y=Math.PI*.38;g.add(leafGroup);b(leafGroup,accent,width*.44,.35,0,width*.88,.7,.035);b(leafGroup,ink,width*.74,.33,.026,.04,.025,.03);
   // The horizontal sill number remains legible from the plan camera even
   // when a tall retained wall obscures its vertical door plaque.
   if(!numbered.has(room.id)){const number=sign(g,room.id,Math.min(1.05,Math.max(.65,room.label.length*.13)),.30);if(number){number.rotation.x=-Math.PI/2;number.position.set(0,.12,(door.normal[0]*-door.tangent[1]+door.normal[1]*door.tangent[0])*.29);}numbered.add(room.id);}
   const plaque=sign(leafGroup,room.id,width*.62,.19);if(plaque)plaque.position.set(width*.44,.55,.024);
  }
  for(const landing of f.landings){
   const g=new THREE.Group();
   g.position.set(landing.center[0],.10,landing.center[1]);
   root.add(g);
   const mark=sign(g,'floor',.65,.4);
   if(mark){mark.rotation.x=-Math.PI/2;mark.position.z=-.45;}
  }
 }
 const floors=new Map();
 for(const [number,floor] of campus.floors){
  const root=new THREE.Group();
  for(const space of floor.spaces){
   const props=new THREE.Group();
   props.position.set(space.center[0],.13,space.center[1]);
   root.add(props);
   roomProps.set(space.id,props);
  }
  addWayfinding(root,floor,number);
  floors.set(number,root);
 }
 const roomShowcases=new Map();
 for(const space of campus.floors.get(4).spaces){
  const room=pilotRoomBySpace(space.id);
  if(room)roomShowcases.set(space.id,roomShowcase(room));
 }
 const consolidated=new Map();
 for(const [parent,map] of batches){let root=parent;while(root.parent)root=root.parent;root.updateMatrixWorld(true);if(!consolidated.has(root))consolidated.set(root,new Map());const target=consolidated.get(root);for(const [key,batch] of map){if(!target.has(key))target.set(key,{geo:batch.geo,mat:batch.mat,items:[]});for(const item of batch.items){let owner=parent;while(owner&&!owner.userData.spaceId)owner=owner.parent;target.get(key).items.push({...item,parentMatrix:parent.matrixWorld.clone(),spaceId:owner?.userData.spaceId});}}}
 const dummy=new THREE.Object3D();
 for(const [parent,map] of consolidated)for(const {geo,mat,items} of map.values()){
  const mesh=new THREE.InstancedMesh(geo,mat,items.length);
  items.forEach(({x,y,z,w,h,d,ry,parentMatrix},i)=>{
   dummy.position.set(x,y,z);
   dummy.rotation.set(0,ry,0);
   dummy.scale.set(w,h,d);
   dummy.updateMatrix();
   const matrix=new THREE.Matrix4().multiplyMatrices(parentMatrix,dummy.matrix);
   mesh.setMatrixAt(i,matrix);
  });
  mesh.castShadow=mat!==shade;
  mesh.receiveShadow=true;
  parent.add(mesh);
 }
 function dispose(){
  for(const parent of consolidated.keys())parent.traverse(object=>{
   if(object.isInstancedMesh)object.dispose();
  });
 }
 return {floors,roomProps,roomShowcases,dispose};
}

function cushionGeometry(width,height,depth){
 const minX=-width/2,minY=-height/2,maxX=width/2,maxY=height/2,radius=.045;
 const shape=new THREE.Shape();
 shape.moveTo(minX+radius,minY);
 shape.lineTo(maxX-radius,minY);
 shape.quadraticCurveTo(maxX,minY,maxX,minY+radius);
 shape.lineTo(maxX,maxY-radius);
 shape.quadraticCurveTo(maxX,maxY,maxX-radius,maxY);
 shape.lineTo(minX+radius,maxY);
 shape.quadraticCurveTo(minX,maxY,minX,maxY-radius);
 shape.lineTo(minX,minY+radius);
 shape.quadraticCurveTo(minX,minY,minX+radius,minY);
 return new THREE.ExtrudeGeometry(shape,{depth,curveSegments:3,bevelEnabled:true,bevelThickness:.012,bevelSize:.012,bevelSegments:2});
}
