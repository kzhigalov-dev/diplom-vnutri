import * as THREE from 'three';
import {floorRoomLayout, isFloorFurnitureSurface} from './floor-room-layout.js?v=20261124-atlas-polish';

export function createFloorFurniture({box, material, depthScale}) {
  const furnitureMaterial = material({color: 0xffffff, roughness: .78});
  const catalog = new Map();
  const floors = new Map();
  const floorBySpace = new Map();
  const transform = new THREE.Object3D();
  const placed = new THREE.Matrix4();
  const color = new THREE.Color();
  const up = new THREE.Vector3(0, 1, 0);

  function addFloor(number, spaces, parent) {
    const floor = {spaces, parent, rooms: null, mesh: null, visible: null};
    floors.set(number, floor);
    for (const space of spaces) floorBySpace.set(space.id, floor);
  }

  function setRoomCatalog(rooms) {
    for (const room of rooms) {
      const floor = floorBySpace.get(room.spaceId);
      if (!floor) continue;
      const before = catalog.get(room.spaceId);
      catalog.set(room.spaceId, room);
      if (before && before.capacity === room.capacity && before.computerCount === room.computerCount &&
          before.purposes.join() === room.purposes.join()) continue;
      floor.rooms = null;
    }
  }

  function prepareFloor(number, visible, detailed) {
    const floor = floors.get(number);
    if (!floor.rooms) {
      floor.mesh?.removeFromParent();
      floor.mesh?.dispose();
      floor.rooms = floor.spaces.flatMap(space => {
        const layout = floorRoomLayout(space, catalog.get(space.id), depthScale);
        if (!layout) return [];
        const {parts, x, z, scaleX, scaleY, scaleZ} = layout;
        const placement = new THREE.Matrix4().makeScale(scaleX, scaleY, scaleZ).setPosition(x, .13, z);
        return [{id: space.id, placement, parts, surfaces: parts.filter(isFloorFurnitureSurface)}];
      });
      const count = floor.rooms.reduce((total, room) => total + room.parts.length, 0);
      floor.mesh = new THREE.InstancedMesh(box, furnitureMaterial, count);
      floor.mesh.name = 'floor-room-furniture';
      floor.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      floor.mesh.frustumCulled = false;
      floor.parent.add(floor.mesh);
      floor.visible = null;
    }
    if (floor.visible === visible && floor.detailed === detailed) return;
    floor.visible = visible;
    floor.detailed = detailed;
    let count = 0;
    for (const room of floor.rooms) {
      if (!visible.has(room.id)) continue;
      for (const part of detailed ? room.parts : room.surfaces) {
        transform.position.set(part.x, part.y, part.z);
        transform.quaternion.setFromAxisAngle(up, part.angle);
        transform.scale.set(part.w, part.h, part.d);
        transform.updateMatrix();
        placed.multiplyMatrices(room.placement, transform.matrix);
        floor.mesh.setMatrixAt(count, placed);
        floor.mesh.setColorAt(count, color.setHex(part.color));
        count += 1;
      }
    }
    floor.mesh.count = count;
    floor.mesh.instanceMatrix.needsUpdate = true;
    if (floor.mesh.instanceColor) floor.mesh.instanceColor.needsUpdate = true;
  }

  function dispose() {
    for (const floor of floors.values()) floor.mesh?.dispose();
  }

  return {addFloor, prepareFloor, setRoomCatalog, dispose};
}
