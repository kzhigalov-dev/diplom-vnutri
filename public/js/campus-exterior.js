import * as THREE from 'three';
import {architecturalFinish} from './architectural-finishes.js?v=20261124-atlas-polish';
import {toWorld} from './geometry.js';

// Photo-informed architectural maquette, not a surveyed elevation. The street
// front is the long, straight edge opposite the three courtyard wings.
// Campus gallery, January 2026 street photographs and KGIOP Order 1281-рп,
// appendix 3, identify the three loggias and three spans of upper glazing.
export function createCampusExterior({campus,box,material,track,textures,depthScale=2.2,entranceX}) {
 const ref=campus.floors.get(4),points=ref.source.footprint.map(p=>{const [x,z]=toWorld(ref.source,...p);return [x+ref.offset[0],(z+ref.offset[1])*depthScale];});
 const minX=Math.min(...points.map(p=>p[0])),maxX=Math.max(...points.map(p=>p[0])),minZ=Math.min(...points.map(p=>p[1])),maxZ=Math.max(...points.map(p=>p[1]));
 const streetEdges=points.map((p,i)=>[p,points[(i+1)%points.length]]).filter(([a,b])=>Math.abs(a[1]-b[1])<.2).sort((a,b)=>Math.abs(b[1][0]-b[0][0])-Math.abs(a[1][0]-a[0][0]));
 const street=streetEdges[0],streetLeft=Math.min(street[0][0],street[1][0]),streetRight=Math.max(street[0][0],street[1][0]),streetZ=(street[0][1]+street[1][1])/2;
 const width=streetRight-streetLeft;
 const ridgeZ=streetZ+3.2;
 const ridgeY=13.4;
 const courtRoofY=12.03;
 const rearEavesZ=ridgeZ+width*.09;
 const roofHeight=z=>THREE.MathUtils.lerp(ridgeY,courtRoofY,THREE.MathUtils.clamp((z-ridgeZ)/(rearEavesZ-ridgeZ),0,1));
 const entryX=entranceX??(streetLeft+streetRight)/2;
 const glazedBays=[streetLeft+width*.18,entryX,streetLeft+width*.84];
 const bayWidth=width*.083;
 const stoneMap=architecturalFinish(THREE,'stone'),glassMap=architecturalFinish(THREE,'glass');
 textures.add(stoneMap);textures.add(glassMap);
 const stone=material({color:0xcecac0,map:stoneMap,roughness:.94});
 const courtStone=material({color:0xcec1b1,map:stoneMap,roughness:1});
 const stoneLight=material({color:0xded9cd,map:stoneMap,roughness:.89});
 const joints=material({color:0xaaa59b,roughness:1});
 const base=material({color:0x393d3c,roughness:.91});
 const reveal=material({color:0x716f64,roughness:.94});
 const frame=material({color:0x504b43,metalness:.09,roughness:.68});
 const glass=material({color:0x879fa8,map:glassMap,metalness:.12,roughness:.31});
 const roofMat=material({color:0x636967,metalness:.25,roughness:.74});
 const seam=material({color:0x7d837d,metalness:.22,roughness:.75});
 const metal=material({color:0x626d68,metalness:.24,roughness:.64});
 const paving=material({color:0xc0bcae,roughness:1});
 const asphalt=material({color:0x6b706d,roughness:.99});
 const batches=new Map();
 const facades=new Map(),roof=new THREE.Group(),site=new THREE.Group();roof.userData.floor=5;
 function b(parent,mat,x,y,z,w,h,d,angle=0,tint=1,roll=0){
  const root=parent.root??parent;
  if(!batches.has(root))batches.set(root,new Map());
  const batch=batches.get(root);
  if(!batch.has(mat))batch.set(mat,[]);
  if(parent.root){
   const {cos,sin,cx,cz}=parent;
   [x,z]=[cx+cos*x+sin*z,cz-sin*x+cos*z];
   angle+=parent.angle;
  }
  batch.get(mat).push({x,y,z,w,h,d,angle,tint,roll});
 }
 function plane(parent,canvas,x,y,z,w,h,ry=0){const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;textures.add(texture);const mesh=new THREE.Mesh(track(new THREE.PlaneGeometry(w,h)),material({map:texture,transparent:true,roughness:.8}));mesh.position.set(x,y,z);mesh.rotation.y=ry;parent.add(mesh);}
 function window(edge,x,y,w,h,side,tint,storefront=false,recessed=false){
  const trim=storefront?base:stoneLight;
  const inset=recessed ? .14 : 0;
  b(edge,reveal,x,y,side*(.18-inset),w+.13,h+.13,.075);
  b(edge,glass,x,y,side*(.223-inset),w,h,.03,0,tint);
  b(edge,trim,x,y+h/2+.045,side*.19,w+.22,.08,.13);
  b(edge,trim,x,y-h/2-.055,side*.20,w+.27,.11,.20);
  for(const edgeX of [x-w/2-.035,x+w/2+.035])b(edge,trim,edgeX,y,side*.18,.075,h,.12);
  const sashDepth=side*(.251-inset);
  for(const offset of [-.26,.26])b(edge,frame,x+w*offset,y,sashDepth,.037,h,.035);
  b(edge,frame,x,y+h*.19,sashDepth,w,.037,.035);
 }
 function rustication(edge,left,right,y,h,z,tone){
  const length=right-left;
  if(length<.08)return;
  const courses=Math.max(1,Math.round(h/.45));
  for(let line=1;line<courses;line++){
   const course=h/courses,wy=y+line*course;
   b(edge,joints,(left+right)/2,wy,z,length,.013,.014,0,tone);
   for(let x=left+(line%2?.68:1.34);x<right-.15;x+=1.42){
    b(edge,joints,x,wy-course/2,z,.012,course,.014,0,tone);
   }
  }
 }
 function streetTier(edge,length,y,h,n){
  const bays=glazedBays.map(x=>({x:(x-edge.cx)*edge.cos,w:bayWidth,glazed:true}));
  const regularCount=Math.floor(length/2.7);
  const spacing=length/regularCount;
  const openings=[...bays];
  for(let j=0;j<regularCount;j++){
   const x=(j+.5)*spacing-length/2;
   if(bays.some(bay=>Math.abs(x-bay.x)<bay.w/2+spacing*.47))continue;
   openings.push({x,w:spacing*(n===1?.72:.63),glazed:false});
  }
  let previous=-length/2;
  for(const {x,w,glazed} of openings.sort((a,b)=>a.x-b.x)){
   const openingWidth=w+(glazed?0:.16),left=x-openingWidth/2,right=x+openingWidth/2;
   const wallMat=n===1?base:stone;
   if(left>previous){
    b(edge,wallMat,(previous+left)/2,y+h/2,0,left-previous,h,.28);
    if(n!==1)rustication(edge,previous,left,y,h,-.15,1);
   }
   previous=right;
   if(glazed){
    if(n===1){
     // Forward floor and granite lintel emphasize the shadowed ground-floor loggia.
     b(edge,base,x,y+.072,-.31,w,.14,.86);
     b(edge,reveal,x,y+h*.47,.17,w-.25,h*.88,.078);
     b(edge,base,x,y+h-.14,-.49,w+.62,.28,1.18);
     b(edge,metal,x,y+h-.075,-1.1,w+.66,.12,.11);
     const isEntrance=Math.abs(x-(entryX-edge.cx)*edge.cos)<.08;
     if(!isEntrance){
      b(edge,glass,x,y+h*.45,.085,w-.36,h*.76,.033,0,.48);
      for(let j=-2;j<=2;j++)b(edge,frame,x+j*w*.161,y+h*.45,.049,.064,h*.76,.095);
     }
     for(const sign of [-1,1]){
      b(edge,stone,x+sign*(w/2-.11),y+h*.46,-.22,.22,h*.92,.60);
     }
    }else{
     b(edge,reveal,x,y+h/2,.075,w,h,.13);
     const paneWidth=(w-.58)/5;
     for(let k=0;k<5;k++){
      const paneX=x+(k-2)*paneWidth;
      b(edge,glass,paneX,y+h*.51,-.031,paneWidth-.11,h-.29,.039,0,.66+((k+n*2)%6)*.046);
      b(edge,frame,paneX,y+h*.73,-.066,paneWidth-.05,.066,.065);
     }
     for(let k=1;k<5;k++)b(edge,stoneLight,x+(k-2.5)*paneWidth,y+h/2,-.11,.098,h,.20);
     for(const sign of [-1,1])b(edge,stoneLight,x+sign*(w/2-.18),y+h/2,-.20,.34,h,.48);
     b(edge,stoneLight,x,y+.11,-.25,w+.1,.18,.48);
     if(n===4)b(edge,stoneLight,x,y+h-.12,-.25,w+.33,.23,.61);
    }
    continue;
   }
   const height=n===1?1.96:1.30,center=y+(n===1?1.18:h*.53);
   const bottom=center-height/2-.07,top=center+height/2+.07;
   b(edge,wallMat,x,(bottom+y)/2,0,openingWidth,bottom-y,.28);
   b(edge,wallMat,x,(top+y+h)/2,0,openingWidth,y+h-top,.28);
   window(edge,x,center,w,height,-1,.72+((Math.round(x*7)+320+n*3)%11)*.022,n===1,true);
   if(n>1){
    b(edge,joints,x,y+.32,-.151,w*.66,.24,.019,0,1.03);
    b(edge,stoneLight,x,y+.32,-.168,w*.60,.18,.023);
    if(n===4){
     b(edge,joints,x,y+h-.25,-.161,w*.62,.23,.04);
     for(const mark of [-.18,0,.18])b(edge,stoneLight,x+mark,y+h-.25,-.194,.078,.13,.045,0,1,mark*1.9);
    }
   }
  }
  if(length/2>previous){
   b(edge,n===1?base:stone,(length/2+previous)/2,y+h/2,0,length/2-previous,h,.28);
   if(n!==1)rustication(edge,previous,length/2,y,h,-.15,1);
  }
  if(n===1){
   b(edge,reveal,0,.12,-.20,length,.23,.31);
   for(let x=-length/2+.16;x<length/2-.13;x+=.38){
    b(edge,base,x,2.54,-.19,.35,.24,.18,0,.9+((Math.round(x*11)+480)%11)*.021);
   }
   b(edge,base,0,2.74,-.18,length+.12,.16,.66);
   b(edge,reveal,0,2.88,-.21,length+.16,.13,.63);
  }
 }
 const tiers=[{y:0,h:2.9},{y:2.9,h:2.7},{y:5.6,h:2.7},{y:8.3,h:2.7},{y:11,h:2.15}];
 const winding=points.reduce((sum,[x,z],i)=>{
  const [nx,nz]=points[(i+1)%points.length];
  return sum+x*nz-z*nx;
 },0);
 const outside=winding>=0?-1:1;
 function ridgePoint(streetPoint,wingPoint){
  const [x,z]=streetPoint,[wingX,wingZ]=wingPoint;
  return [x+(wingX-x)*(ridgeZ-z)/(wingZ-z),ridgeZ];
 }
 const roofOutline=points.map((point,index)=>{
  if(Math.abs(point[1]-streetZ)>=.25)return point;
  const previous=points.at(index-1),next=points[(index+1)%points.length];
  return ridgePoint(point,previous[1]>next[1]?previous:next);
 });
 for(let n=1;n<=5;n++){
  const root=new THREE.Group();root.userData.floor=n;facades.set(n,root);const {y,h}=tiers[n-1];
  for(let i=0;i<points.length;i++){
   const originalStart=points[i],next=(i+1)%points.length,originalEnd=points[next];
   const front=originalStart===street[0]&&originalEnd===street[1];
   if(front&&n===5)continue;
   const a=n===5?roofOutline[i]:originalStart,q=n===5?roofOutline[next]:originalEnd;
   const dx=q[0]-a[0],dz=q[1]-a[1],length=Math.hypot(dx,dz);
   if(length<.25)continue;
   const edge={root,cx:(a[0]+q[0])/2,cz:(a[1]+q[1])/2,angle:-Math.atan2(dz,dx),cos:dx/length,sin:-dz/length};
   // Four visible street tiers match the photos. The fifth navigation level is
   // represented by a recessed roof volume; exact floor/elevation registration
   // cannot be recovered from the supplied wayfinding diagrams.
   if(n===5){
    const profile=new THREE.Shape();
    profile.moveTo(-length/2,y);
    profile.lineTo(length/2,y);
    profile.lineTo(length/2,roofHeight(q[1])-.10);
    profile.lineTo(-length/2,roofHeight(a[1])-.10);
    profile.closePath();
    const attic=new THREE.Mesh(track(new THREE.ExtrudeGeometry(profile,{depth:.28,bevelEnabled:false})),roofMat);
    attic.position.set(edge.cx-edge.sin*.14,0,edge.cz-edge.cos*.14);
    attic.rotation.y=edge.angle;
    root.add(attic);
   }else if(front)streetTier(edge,length,y,h,n);
   else b(edge,courtStone,0,y+h/2,0,length,h,.28,0,.94+((i*7+n*3)%7)*.01);
   if(n===5&&(a!==originalStart||q!==originalEnd)){
    const streetAtStart=a!==originalStart;
    const ridge=streetAtStart?a:q,streetEnd=streetAtStart?originalStart:originalEnd;
    const riseWidth=Math.hypot(streetEnd[0]-ridge[0],streetEnd[1]-ridge[1])*(streetAtStart?-1:1);
    const cap=new THREE.Shape();
    cap.moveTo(0,y);cap.lineTo(riseWidth,y);cap.lineTo(riseWidth,11.13);cap.lineTo(0,ridgeY);cap.closePath();
    const endWall=new THREE.Mesh(track(new THREE.ExtrudeGeometry(cap,{depth:.28,bevelEnabled:false})),stone);
    endWall.position.set(ridge[0]-edge.sin*.14,0,ridge[1]-edge.cos*.14);
    endWall.rotation.y=edge.angle;
    root.add(endWall);
   }
   if(!front&&n<5){
    const wingHead=Math.abs(dz)<.22&&edge.cz>maxZ-1.4&&length>4.2&&length<9.8;
    const count=wingHead?3:Math.max(1,Math.floor(length/2.35));
    const spacing=length/count;
    for(let j=0;j<count;j++){
     const x=(j+.5)*spacing-length/2;
     const stairWindow=wingHead&&j===1;
     const paneTone=.73+((i*5+j*3+n*7)%11)*.023;
     window(edge,x,y+h*(stairWindow?.49:.56),Math.min(stairWindow?.93:1.18,spacing*.59),stairWindow?1.92:1.36,outside,paneTone);
    }
    if(wingHead){
     for(const pilasterX of [-length*.22,length*.22]){
      b(edge,stoneLight,pilasterX,y+h/2,outside*.18,.15,h,.17);
     }
    }
    if(n===1){
     rustication(edge,-length/2,length/2,y,h,outside*.15,.94);
     b(edge,base,0,.11,0,length+.13,.22,.39);
    }
   }
   if(n===4){
    b(edge,stoneLight,0,y+h-.14,0,length+.20,.17,.47);
    b(edge,stoneLight,0,y+h-.01,0,length+.36,.12,.68);
    b(edge,metal,0,y+h+.065,0,length+.38,.045,.70);
   }
  }
 }
 const entry=facades.get(1);
 const doorWidth=1.13;
 for(const x of [-doorWidth,0,doorWidth]){
  b(entry,frame,entryX+x,1.18,streetZ-.225,doorWidth,2.29,.14);
  b(entry,glass,entryX+x,1.37,streetZ-.303,doorWidth-.21,1.71,.027,0,.66);
  b(entry,metal,entryX+x+.25,.97,streetZ-.338,.035,.35,.06);
  b(entry,frame,entryX+x,1.14,streetZ-.326,.036,1.87,.045);
 }
 b(entry,base,entryX,.026,streetZ-1.02,5.34,.07,1.50);
 b(entry,stoneLight,entryX,.082,streetZ-.80,5.20,.07,1.32);
 for(const side of [-1,1]){
  b(entry,base,entryX+side*2.22,1.30,streetZ-.56,.39,2.60,.34);
  b(entry,stoneLight,entryX+side*2.22,2.45,streetZ-.58,.54,.18,.46);
  b(entry,metal,entryX+side*2.77,1.51,streetZ-.447,.63,.44,.06);
 }
 if(typeof document!=='undefined'){
  const sign=document.createElement('canvas');sign.width=2048;sign.height=128;const c=sign.getContext('2d');c.fillStyle='#dedbcd';c.font='600 43px sans-serif';c.textAlign='center';c.fillText('САНКТ-ПЕТЕРБУРГСКИЙ ГОСУДАРСТВЕННЫЙ УНИВЕРСИТЕТ',1024,52);c.font='600 40px sans-serif';c.fillText('ПРОМЫШЛЕННЫХ ТЕХНОЛОГИЙ И ДИЗАЙНА',1024,106);plane(facades.get(4),sign,(glazedBays[0]+glazedBays[1])/2,8.52,streetZ-.335,width*.31,.54,Math.PI);
  const doorSign=document.createElement('canvas');doorSign.width=1024;doorSign.height=128;const d=doorSign.getContext('2d');d.fillStyle='#e9e3ca';d.font='600 70px sans-serif';d.textAlign='center';d.fillText('СПбГУПТД',512,91);plane(entry,doorSign,entryX,2.76,streetZ-1.13,3.4,.27,Math.PI);
 }
 // Shallow standing-seam roofs follow the actual comb footprint, not a single
 // oversized pitched roof stretched across all three open courtyards.
 const shape=new THREE.Shape();
 shape.moveTo(roofOutline[0][0],-roofOutline[0][1]);
 for(const [x,z] of roofOutline.slice(1))shape.lineTo(x,-z);
 shape.closePath();
 const slab=track(new THREE.ExtrudeGeometry(shape,{depth:.22,bevelEnabled:false}));
 slab.rotateX(-Math.PI/2);
 const roofVertices=slab.getAttribute('position');
 for(let vertex=0;vertex<roofVertices.count;vertex++){
  roofVertices.setY(vertex,roofVertices.getY(vertex)+roofHeight(roofVertices.getZ(vertex))-.22);
 }
 roofVertices.needsUpdate=true;
 slab.computeVertexNormals();
 roof.add(new THREE.Mesh(slab,roofMat));
 // A shallow metal pitch rises behind the street cornice. Its sloped face,
 // rather than a tall opaque fascia, retains the low skyline in the photographs.
 const [ridgeLeft,ridgeRight]=roofOutline.filter(p=>p[1]===ridgeZ).map(([x])=>x).sort((a,b)=>a-b);
 const pitch=track(new THREE.BufferGeometry());pitch.setAttribute('position',new THREE.Float32BufferAttribute([
  streetLeft,11.13,streetZ-.12, ridgeLeft,ridgeY,ridgeZ, streetRight,11.13,streetZ-.12,
  streetRight,11.13,streetZ-.12, ridgeLeft,ridgeY,ridgeZ, ridgeRight,ridgeY,ridgeZ
 ],3));pitch.computeVertexNormals();roof.add(new THREE.Mesh(pitch,roofMat));
 b(roof,stoneLight,(streetLeft+streetRight)/2,11.08,streetZ-.12,width+.2,.16,.45);
 const seamWidth=width/36;
 const pitchDepth=3.32,pitchRise=2.27;
 const pitchSeam=track(new THREE.BoxGeometry(.055,.028,Math.hypot(pitchDepth,pitchRise)));
 pitchSeam.rotateX(-Math.atan2(pitchRise,pitchDepth));
 const standingSeams=new THREE.InstancedMesh(pitchSeam,seam,35);
 const seamTransform=new THREE.Matrix4();
 for(let i=0;i<standingSeams.count;i++){
  seamTransform.makeTranslation(streetLeft+(i+1)*seamWidth,12.28,streetZ+1.54);
  standingSeams.setMatrixAt(i,seamTransform);
 }
 roof.add(standingSeams);
 const rearPitchDepth=rearEavesZ-ridgeZ,rearPitchRise=ridgeY-courtRoofY;
 const rearPitchSeam=track(new THREE.BoxGeometry(.045,.026,Math.hypot(rearPitchDepth,rearPitchRise)));
 rearPitchSeam.rotateX(Math.atan2(rearPitchRise,rearPitchDepth));
 const rearSeams=new THREE.InstancedMesh(rearPitchSeam,seam,32);
 for(let i=0;i<rearSeams.count;i++){
  seamTransform.makeTranslation(streetLeft+(i+1)*seamWidth,(ridgeY+courtRoofY)/2+.016,(ridgeZ+rearEavesZ)/2);
  rearSeams.setMatrixAt(i,seamTransform);
 }
 roof.add(rearSeams);
 // Follow the three source-defined wings with independent courses of metal roofing.
 const wingHeads=points.map((a,i)=>[a,points[(i+1)%points.length]]).filter(([a,q])=>Math.abs(a[1]-q[1])<.2&&Math.abs(a[0]-q[0])>4&&Math.abs(a[0]-q[0])<10&&a[1]>maxZ-1.4);
 for(const [a,q] of wingHeads){
  const x=(a[0]+q[0])/2,z=(a[1]+q[1])/2,wingWidth=Math.abs(a[0]-q[0]),startZ=ridgeZ+7.5;
  b(roof,metal,x,courtRoofY-.025,z,wingWidth+.16,.15,.24);
  for(let wx=x-wingWidth/2+.54;wx<x+wingWidth/2-.22;wx+=.68){
   b(roof,seam,wx,courtRoofY+.015,(z+startZ)/2,.043,.027,z-startZ-.18);
  }
 }
 b(site,base,(minX+maxX)/2,-.65,(minZ+maxZ)/2,maxX-minX+5,.65,maxZ-minZ+7);
 b(site,paving,(minX+maxX)/2,-.29,(minZ+maxZ)/2,maxX-minX+4,.08,maxZ-minZ+6);
 b(site,paving,(streetLeft+streetRight)/2,-.19,streetZ-2.05,width+3,.16,3.7);
 b(site,asphalt,(streetLeft+streetRight)/2,-.3,streetZ-5.1,width+5,.06,3.1);
 b(site,stoneLight,(streetLeft+streetRight)/2,-.17,streetZ-3.95,width+3,.14,.16);
 for(let x=streetLeft-.2;x<streetRight+1.4;x+=1.32){
  b(site,joints,x,-.106,streetZ-2.05,.018,.012,3.64);
 }
 for(const z of [streetZ-1.4,streetZ-2.58]){
  b(site,joints,(streetLeft+streetRight)/2,-.106,z,width+2.78,.012,.018);
 }
 for(let x=streetLeft+1;x<streetRight-1.8;x+=1.8){
  if(Math.abs(x-entryX)<4)continue;
  const railZ=streetZ-3.35;
  b(site,base,x,.29,railZ,.064,.82,.065);
  for(const railY of [.05,.57])b(site,base,x+.9,railY,railZ,1.8,.035,.045);
  for(const sign of [-1,1])b(site,base,x+.9,.3,railZ,Math.hypot(1.8,.52),.026,.032,0,1,sign*Math.atan2(.52,1.8));
 }
 for(const z of [streetZ-4.95,streetZ-5.90]){
  b(site,reveal,(streetLeft+streetRight)/2,-.268,z,width+4,.016,.064);
  b(site,seam,(streetLeft+streetRight)/2,-.257,z,width+4,.009,.028);
 }
 const dummy=new THREE.Object3D(),tintColor=new THREE.Color();
 for(const [root,map] of batches)for(const [mat,items] of map){
  const mesh=new THREE.InstancedMesh(box,mat,items.length);
  const tinted=items.some(item=>item.tint!==1);
  items.forEach((item,index)=>{
   const {x,y,z,w,h,d,angle,roll,tint}=item;
   dummy.position.set(x,y,z);
   dummy.rotation.set(0,angle,roll);
   dummy.scale.set(w,h,d);
   dummy.updateMatrix();
   mesh.setMatrixAt(index,dummy.matrix);
   if(tinted)mesh.setColorAt(index,tintColor.setRGB(tint,tint,tint));
  });
  root.add(mesh);
 }
 return {facades,roof,site,footprint:points,levelBases:tiers.map(t=>t.y),entrance:{x:entryX,z:streetZ-1.72},front:{x:(streetLeft+streetRight)/2,z:streetZ},bounds:{minX,maxX,minZ,maxZ},dispose(){for(const root of [...facades.values(),roof,site])root.traverse(o=>{if(o.isInstancedMesh)o.dispose();});}};
}
