/*
 * Loads a VRoid-made VRM 0.x avatar and presents it to CharacterEngine in
 * exactly the shape its PMX loader (ZS in characterEngine.ts) produces, so the
 * existing pose, idle, gaze, lip-sync, physics and material code runs on it
 * unchanged. Nothing here is used for PMX characters.
 *
 * What the translation does:
 *  - Coordinates: VRM 0.x faces -Z in metres; the PMX path yields models
 *    facing +Z in MMD units. We rotate 180 deg about Y and scale (see
 *    MMD_UNITS_PER_METRE). VRoid bones, like MMD bones, carry no rest
 *    rotation, so bone-local rotations mean the same thing on both.
 *  - Skeleton: VRoid humanoid bones are renamed to their MMD names, and the
 *    MMD control bones VRoid lacks are synthesised (センター, グルーブ,
 *    下半身, 両目 with grants driving 左目/右目), so the character config can
 *    reuse the base rig's bone map.
 *  - Mesh: the VRM's meshes/primitives are merged into one SkinnedMesh with
 *    one material group per primitive; face blend shapes become vertex morphs
 *    named as in the VRM (Fcl_MTH_A, Fcl_EYE_Close, ...).
 *  - Materials are named by role ("skin", "hair", "iris", ...) so the config's
 *    materialRoles/materialTuning apply however VRoid names them.
 *  - Spring bones (hair, skirt) become dynamic rigid bodies so the engine's
 *    bone physics sways them. Bust springs are deliberately left out.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/** Scales VRoid's metres so SIYA stands at the base rig's height (camera framing). */
const MMD_UNITS_PER_METRE = 13.5;

const SIDE_BONES: Array<[string, string]> = [
  ["Shoulder", "肩"], ["UpperArm", "腕"], ["LowerArm", "ひじ"], ["Hand", "手首"],
  ["UpperLeg", "足"], ["LowerLeg", "ひざ"], ["Foot", "足首"], ["ToeBase", "つま先"],
  ["Thumb1", "親指０"], ["Thumb2", "親指１"], ["Thumb3", "親指２"],
  ["Index1", "人指１"], ["Index2", "人指２"], ["Index3", "人指３"],
  ["Middle1", "中指１"], ["Middle2", "中指２"], ["Middle3", "中指３"],
  ["Ring1", "薬指１"], ["Ring2", "薬指２"], ["Ring3", "薬指３"],
  ["Little1", "小指１"], ["Little2", "小指２"], ["Little3", "小指３"],
];

const BONE_RENAME: Record<string, string> = {
  Root: "全ての親",
  J_Bip_C_Hips: "腰",
  J_Bip_C_Spine: "上半身",
  J_Bip_C_Chest: "上半身2",
  J_Bip_C_Neck: "首",
  J_Bip_C_Head: "頭",
  J_Adj_L_FaceEye: "左目",
  J_Adj_R_FaceEye: "右目",
};
for (const [vroid, mmd] of SIDE_BONES) {
  BONE_RENAME[`J_Bip_L_${vroid}`] = `左${mmd}`;
  BONE_RENAME[`J_Bip_R_${vroid}`] = `右${mmd}`;
}
const LEG_ROOTS = new Set(["J_Bip_L_UpperLeg", "J_Bip_R_UpperLeg"]);

/** Material role from VRoid's material naming (N00_000_00_Face_00_SKIN ...). */
function materialRole(name: string): string {
  if (/FaceMouth/i.test(name)) return "mouth";
  if (/EyeIris/i.test(name)) return "iris";
  if (/EyeHighlight/i.test(name)) return "catchlight";
  if (/EyeWhite/i.test(name)) return "eyeWhite";
  if (/FaceBrow/i.test(name)) return "brow";
  if (/FaceEyeline|FaceEyelash|EyeExtra/i.test(name)) return "lash";
  if (/Face_\d+_SKIN|_FACE\b/i.test(name)) return "face";
  if (/_SKIN\b/i.test(name)) return "skin";
  if (/HAIR/i.test(name)) return "hair";
  return "cloth";
}

/** Face blend shapes worth uploading as morph targets (skips fang/teeth variants). */
const USEFUL_MORPH = /^Fcl_(ALL|BRW|EYE|MTH)_/;

interface LoadOptions {
  modelUrl: string;
  createMaterial: (params: Record<string, unknown>, loader: THREE.TextureLoader) => THREE.Material;
  onProgress?: (phase: string, ratio: number) => void;
  /** characterEngine's ambient-occlusion bake (passed in to avoid a circular import). */
  bakeAmbientOcclusion?: (geometry: THREE.BufferGeometry) => void;
}

interface GlbParts {
  json: any;
  bin: ArrayBuffer;
}

function splitGlb(buffer: ArrayBuffer): GlbParts {
  const view = new DataView(buffer);
  if (view.getUint32(0, true) !== 0x46546c67) throw new Error("Not a GLB/VRM file");
  let offset = 12;
  let json: any = null;
  let bin: ArrayBuffer | null = null;
  while (offset < buffer.byteLength) {
    const length = view.getUint32(offset, true);
    const type = view.getUint32(offset + 4, true);
    const start = offset + 8;
    if (type === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, start, length)));
    else if (type === 0x004e4942) bin = buffer.slice(start, start + length);
    offset = start + length;
  }
  if (!json || !bin) throw new Error("VRM is missing its JSON or binary chunk");
  return { json, bin };
}

/** Object URL for glTF image `index`, or null. Freed after the textures load. */
function imageUrl(parts: GlbParts, index: number | undefined, urls: string[]): string | null {
  if (index === undefined || index < 0) return null;
  const image = parts.json.images?.[index];
  const view = image && parts.json.bufferViews?.[image.bufferView];
  if (!view) return null;
  const bytes = new Uint8Array(parts.bin, view.byteOffset ?? 0, view.byteLength);
  const url = URL.createObjectURL(new Blob([bytes], { type: image.mimeType || "image/png" }));
  urls.push(url);
  return url;
}

export async function loadVrmAsMmdModel(options: LoadOptions) {
  const { modelUrl, createMaterial, onProgress, bakeAmbientOcclusion } = options;
  const progress = (phase: string, ratio: number) => onProgress?.(phase, ratio);
  const s = MMD_UNITS_PER_METRE;
  const toMmd = (v: THREE.Vector3) => v.set(-v.x * s, v.y * s, -v.z * s);

  progress("Fetching model", 0);
  const response = await fetch(modelUrl);
  if (!response.ok) throw new Error(`Failed to fetch model: ${response.status} ${modelUrl}`);
  const buffer = await response.arrayBuffer();
  const parts = splitGlb(buffer);
  const vrm = parts.json.extensions?.VRM;
  if (!vrm) throw new Error("Only VRM 0.x files are supported (export as VRM0.0 in VRoid Studio).");

  progress("Parsing model", 0.15);
  const gltf = await new GLTFLoader().parseAsync(buffer, "");
  gltf.scene.updateMatrixWorld(true);
  const skinned: THREE.SkinnedMesh[] = [];
  gltf.scene.traverse((o) => {
    if ((o as THREE.SkinnedMesh).isSkinnedMesh) skinned.push(o as THREE.SkinnedMesh);
  });
  if (skinned.length === 0) throw new Error("VRM has no skinned meshes");
  const rootNode = gltf.scene.getObjectByName("Root");
  if (!rootNode) throw new Error("VRM has no 'Root' bone (not a VRoid export?)");

  // ---------------------------------------------------------------- skeleton
  progress("Building skeleton", 0.3);
  interface BoneSpec {
    name: string;
    parent: number;
    position: THREE.Vector3; // absolute, MMD space
    source: THREE.Object3D | null;
  }
  const specs: BoneSpec[] = [];
  const indexOfSource = new Map<THREE.Object3D, number>();
  const worldPos = (o: THREE.Object3D) => toMmd(o.getWorldPosition(new THREE.Vector3()));
  const add = (name: string, parent: number, position: THREE.Vector3, source: THREE.Object3D | null) => {
    specs.push({ name, parent, position, source });
    if (source) indexOfSource.set(source, specs.length - 1);
    return specs.length - 1;
  };

  const hips = rootNode.getObjectByName("J_Bip_C_Hips");
  const head = rootNode.getObjectByName("J_Bip_C_Head");
  if (!hips || !head) throw new Error("VRM humanoid is missing hips or head");
  const hipsPos = worldPos(hips);
  const root = add("全ての親", -1, worldPos(rootNode), rootNode);
  const center = add("センター", root, hipsPos.clone(), null);
  const groove = add("グルーブ", center, hipsPos.clone(), null);

  const visit = (node: THREE.Object3D, parent: number) => {
    if (!(node as THREE.Bone).isBone && node !== rootNode) return;
    let index: number;
    if (node === hips) {
      index = add("腰", groove, hipsPos.clone(), node);
      const lowerBody = add("下半身", index, hipsPos.clone(), null);
      for (const child of node.children) visit(child, LEG_ROOTS.has(child.name) ? lowerBody : index);
      return;
    }
    index = add(BONE_RENAME[node.name] ?? node.name, parent, worldPos(node), node);
    if (node === head) {
      const eyeL = head.getObjectByName("J_Adj_L_FaceEye");
      const eyeR = head.getObjectByName("J_Adj_R_FaceEye");
      const mid = eyeL && eyeR ? worldPos(eyeL).add(worldPos(eyeR)).multiplyScalar(0.5) : worldPos(head);
      add("両目", index, mid, null);
    }
    for (const child of node.children) visit(child, index);
  };
  for (const child of rootNode.children) visit(child, root);

  const boneByName = new Map<string, number>();
  specs.forEach((b, i) => boneByName.has(b.name) || boneByName.set(b.name, i));
  const bothEyes = boneByName.get("両目");
  const boneInfos = specs.map((b, index) => ({
    index,
    name: b.name,
    parentIndex: b.parent,
    position: b.position,
    flag: 0,
    transformationClass: 0,
    ik: undefined,
    // MMD eyes follow the 両目 control bone through a rotation grant.
    grant:
      bothEyes !== undefined && (b.name === "左目" || b.name === "右目")
        ? { parentIndex: bothEyes, ratio: 1, affectRotation: true, affectPosition: false, isLocal: false }
        : undefined,
  }));
  const bones = specs.map((b) => {
    const bone = new THREE.Bone();
    bone.name = b.name;
    return bone;
  });
  const skeletonRoot = new THREE.Object3D();
  specs.forEach((b, i) => {
    if (b.parent >= 0) {
      bones[b.parent].add(bones[i]);
      bones[i].position.subVectors(b.position, specs[b.parent].position);
    } else {
      skeletonRoot.add(bones[i]);
      bones[i].position.copy(b.position);
    }
  });
  skeletonRoot.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);

  // -------------------------------------------------------------- geometry
  progress("Building geometry", 0.45);
  const vertexCount = skinned.reduce((n, m) => n + m.geometry.getAttribute("position").count, 0);
  const indexCount = skinned.reduce((n, m) => n + (m.geometry.index?.count ?? 0), 0);
  const position = new Float32Array(vertexCount * 3);
  const normal = new Float32Array(vertexCount * 3);
  const uv = new Float32Array(vertexCount * 2);
  const skinIndex = new Uint16Array(vertexCount * 4);
  const skinWeight = new Float32Array(vertexCount * 4);
  const indices = new Uint32Array(indexCount);
  const geometry = new THREE.BufferGeometry();

  const morphNames: string[] = [];
  const morphArrays = new Map<string, Float32Array>();
  for (const mesh of skinned) {
    for (const name of Object.keys(mesh.morphTargetDictionary ?? {})) {
      if (USEFUL_MORPH.test(name) && !morphArrays.has(name)) {
        morphNames.push(name);
        morphArrays.set(name, new Float32Array(vertexCount * 3));
      }
    }
  }

  const textureLoader = new THREE.TextureLoader();
  const objectUrls: string[] = [];
  const materials: THREE.Material[] = [];
  const materialInfos: Array<Record<string, unknown>> = [];
  const gltfMaterialIndex = new Map<string, number>();
  (parts.json.materials ?? []).forEach((m: any, i: number) => gltfMaterialIndex.set(m.name, i));

  let vertexBase = 0;
  let indexBase = 0;
  const v = new THREE.Vector3();
  for (const mesh of skinned) {
    const g = mesh.geometry;
    const pos = g.getAttribute("position");
    const nor = g.getAttribute("normal");
    const tex = g.getAttribute("uv");
    const si = g.getAttribute("skinIndex");
    const sw = g.getAttribute("skinWeight");
    const jointMap = mesh.skeleton.bones.map((b) => indexOfSource.get(b) ?? 0);
    for (let k = 0; k < pos.count; k++) {
      const o = vertexBase + k;
      toMmd(v.fromBufferAttribute(pos, k));
      position.set([v.x, v.y, v.z], o * 3);
      if (nor) {
        v.fromBufferAttribute(nor, k);
        normal.set([-v.x, v.y, -v.z], o * 3);
      }
      if (tex) uv.set([tex.getX(k), 1 - tex.getY(k)], o * 2); // engine's TextureLoader flips Y
      for (let c = 0; c < 4; c++) {
        skinIndex[o * 4 + c] = jointMap[si.getComponent(k, c)] ?? 0;
        skinWeight[o * 4 + c] = sw.getComponent(k, c);
      }
    }
    const targets = g.morphAttributes.position ?? [];
    for (const [name, i] of Object.entries(mesh.morphTargetDictionary ?? {})) {
      const out = morphArrays.get(name);
      const delta = targets[i as number];
      if (!out || !delta) continue;
      for (let k = 0; k < delta.count; k++) {
        v.fromBufferAttribute(delta, k);
        out.set([-v.x * s, v.y * s, -v.z * s], (vertexBase + k) * 3);
      }
    }
    const idx = g.index;
    const count = idx ? idx.count : pos.count;
    for (let k = 0; k < count; k++) indices[indexBase + k] = vertexBase + (idx ? idx.getX(k) : k);

    // One material group per primitive.
    const gltfMaterial = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    const sourceName = gltfMaterial?.name ?? `material${materials.length}`;
    const role = materialRole(sourceName);
    const props = vrm.materialProperties?.find((p: any) => p.name === sourceName) ?? {};
    const color = props.vectorProperties?._Color ?? [1, 1, 1, 1];
    const mainTex = props.textureProperties?._MainTex;
    const gltfIndex = gltfMaterialIndex.get(sourceName);
    const baseTex = mainTex ?? (gltfIndex !== undefined
      ? parts.json.materials[gltfIndex]?.pbrMetallicRoughness?.baseColorTexture?.index
      : undefined);
    const mapUrl = imageUrl(parts, baseTex !== undefined ? parts.json.textures?.[baseTex]?.source : undefined, objectUrls);
    const materialIndex = materials.length;
    geometry.addGroup(indexBase, count, materialIndex);
    const params = {
      index: materialIndex,
      name: role,
      diffuse: [color[0], color[1], color[2], color[3] ?? 1],
      specular: [0, 0, 0],
      shininess: 0,
      ambient: [0.5, 0.5, 0.5],
      flag: props.floatProperties?._CullMode === 0 ? 1 : 0,
      edgeColor: [0, 0, 0, 1],
      edgeSize: 0,
      mapUrl,
      toonUrl: null,
      sphereUrl: null,
      sphereMode: 0,
    };
    materials.push(createMaterial(params, textureLoader));
    materialInfos.push({
      index: materialIndex,
      name: role,
      start: indexBase,
      count,
      edgeSize: 0,
      edgeColor: new THREE.Color(0, 0, 0),
      flag: params.flag,
      sourceName,
    });
    vertexBase += pos.count;
    indexBase += count;
  }
  // Texture loads are async; release the blob URLs once they have had time to decode.
  setTimeout(() => objectUrls.forEach((u) => URL.revokeObjectURL(u)), 30_000);

  for (let k = 0; k < vertexCount; k++) {
    const sum = skinWeight[k * 4] + skinWeight[k * 4 + 1] + skinWeight[k * 4 + 2] + skinWeight[k * 4 + 3];
    if (sum > 0 && Math.abs(sum - 1) > 1e-4) for (let c = 0; c < 4; c++) skinWeight[k * 4 + c] /= sum;
  }
  geometry.setAttribute("position", new THREE.BufferAttribute(position, 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(normal, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  geometry.setAttribute("skinIndex", new THREE.BufferAttribute(skinIndex, 4));
  geometry.setAttribute("skinWeight", new THREE.BufferAttribute(skinWeight, 4));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));

  // ---------------------------------------------------------------- morphs
  progress("Building morphs", 0.7);
  const vertexMorphs = new Map<string, { name: string; panel: number; morphTargetIndex: number }>();
  const morphAttributes = morphNames.map((name, i) => {
    const attr = new THREE.BufferAttribute(morphArrays.get(name)!, 3);
    attr.name = name;
    vertexMorphs.set(name, { name, panel: 0, morphTargetIndex: i });
    return attr;
  });
  if (morphAttributes.length) {
    geometry.morphAttributes.position = morphAttributes;
    geometry.morphTargetsRelative = true;
  }

  const mesh = new THREE.SkinnedMesh(geometry, materials);
  mesh.name = vrm.meta?.title || "SIYA";
  mesh.normalizeSkinWeights();
  mesh.add(skeletonRoot);
  mesh.bind(skeleton);
  mesh.frustumCulled = false;
  mesh.morphTargetDictionary = {};
  mesh.morphTargetInfluences = new Array(morphAttributes.length).fill(0);
  vertexMorphs.forEach((m) => {
    mesh.morphTargetDictionary![m.name] = m.morphTargetIndex;
  });
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  progress("Baking ambient occlusion", 0.85);
  bakeAmbientOcclusion?.(geometry);

  // --------------------------------------------------------------- physics
  progress("Reading physics", 0.9);
  const springBones = new Set<number>();
  for (const group of vrm.secondaryAnimation?.boneGroups ?? []) {
    if (/bust/i.test(group.comment ?? "")) continue;
    for (const nodeIndex of group.bones ?? []) {
      const node = gltf.scene.getObjectByName(parts.json.nodes[nodeIndex]?.name);
      node?.traverse((o) => {
        const i = indexOfSource.get(o);
        if (i !== undefined) springBones.add(i);
      });
    }
  }
  const rigidBodies = [...springBones].map((boneIndex, index) => ({
    index,
    name: specs[boneIndex].name,
    boneIndex,
    groupIndex: 0,
    groupTarget: 0,
    shape: "capsule",
    size: new THREE.Vector3(0.3, 1, 0),
    position: specs[boneIndex].position.clone(),
    rotation: new THREE.Quaternion(),
    mass: 1,
    positionDamping: 0.5,
    rotationDamping: 0.5,
    restitution: 0,
    friction: 0.5,
    type: "dynamic",
  }));

  progress("Ready", 1);
  return {
    name: mesh.name,
    mesh,
    skeleton,
    bones,
    boneInfos,
    boneIndexByName: boneByName,
    materials: materialInfos,
    vertexMorphs,
    boneMorphs: new Map(),
    groupMorphs: new Map(),
    rigidBodies,
    constraints: [],
    iks: [],
    grants: boneInfos.filter((b) => b.grant).map((b) => ({ boneIndex: b.index, info: b.grant })),
    boundingBox: geometry.boundingBox ?? new THREE.Box3(),
  };
}
