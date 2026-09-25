/*
 * Skeleton retargeting: Kimodo's SOMA 30-joint output -> SIYA's MMD PMX
 * bone skeleton (see characterEngine.ts's `bones` config, e.g. "upperBody",
 * "armL", "elbowL" -- the semantic keys, not the raw PMX Japanese names).
 *
 * SOMA joint names/parents/offsets are taken verbatim from Kimodo's own
 * /api/models response (nvidia/Kimodo-SOMA-RP-v1.1, Apache-2.0 skeleton
 * data) -- see docs/kimodo-integration.md for the full audit trail.
 *
 * IMPORTANT — coordinate handedness is a best-effort conversion, not yet
 * visually verified (no way to see the running avatar in this environment).
 * SOMA/glTF conventions are right-handed, Y-up. MMD/PMX is famously
 * left-handed, Y-up. The standard right->left conversion mirrors the Z axis:
 * negate root Z-translation, and negate the X and Y components of each
 * local rotation quaternion (equivalent to a Z-mirror on a right-handed
 * quaternion). If the avatar's motion looks mirrored left/right or rotates
 * the wrong way when this is first tested, that mirror is the first thing
 * to revisit -- flip which components get negated (X,Y vs Z,W) rather than
 * anything else.
 *
 * Unmapped joints (jaw, eyes, toes, abstract hand-shape markers) are left
 * to SIYA's existing procedural/lip-sync systems, per design: Kimodo
 * supplies body motion only.
 */
import * as THREE from "three";

export const SOMA30_NAMES = [
  "Hips", "Spine1", "Spine2", "Chest", "Neck1", "Neck2", "Head", "Jaw",
  "LeftEye", "RightEye", "LeftShoulder", "LeftArm", "LeftForeArm", "LeftHand",
  "LeftHandThumbEnd", "LeftHandMiddleEnd", "RightShoulder", "RightArm",
  "RightForeArm", "RightHand", "RightHandThumbEnd", "RightHandMiddleEnd",
  "LeftLeg", "LeftShin", "LeftFoot", "LeftToeBase", "RightLeg", "RightShin",
  "RightFoot", "RightToeBase",
] as const;

export const SOMA30_JOINT_COUNT = SOMA30_NAMES.length;

/** SOMA joint name -> SIYA's semantic bone key (characterEngine.ts `bones.*`). */
export const SOMA_TO_MMD_BONE: Partial<Record<(typeof SOMA30_NAMES)[number], string>> = {
  Hips: "lowerBody",
  Spine1: "upperBody",
  Chest: "upperBody2",
  Neck1: "neck",
  Head: "head",
  LeftEye: "eyeL",
  RightEye: "eyeR",
  LeftShoulder: "shoulderL",
  LeftArm: "armL",
  LeftForeArm: "elbowL",
  LeftHand: "wristL",
  RightShoulder: "shoulderR",
  RightArm: "armR",
  RightForeArm: "elbowR",
  RightHand: "wristR",
  LeftLeg: "legL",
  LeftShin: "kneeL",
  LeftFoot: "ankleL",
  RightLeg: "legR",
  RightShin: "kneeR",
  RightFoot: "ankleR",
  // Spine2, Jaw, *Eye (already mapped above), *ToeBase, *HandThumbEnd,
  // *HandMiddleEnd are intentionally left unmapped -- no clean 1:1 MMD
  // equivalent, or already owned by lip-sync/procedural systems.
};

const _q = new THREE.Quaternion();

/**
 * Convert one SOMA joint's local rotation (right-handed XYZW quaternion, as
 * returned by Kimodo) into MMD's left-handed bone-local rotation.
 * See the module-level comment: this is the unverified best-effort mirror.
 */
export function somaQuatToMmd(x: number, y: number, z: number, w: number): THREE.Quaternion {
  return _q.set(-x, -y, z, w).clone();
}

export interface RetargetedFrame {
  /** SIYA semantic bone key -> local rotation quaternion for this frame. */
  bones: Map<string, THREE.Quaternion>;
}

/**
 * CharacterEngine bakes `config.basePose` (e.g. armL: {z:-0.58, y:0.1}) into
 * each bone's REST quaternion at load time (see `pose.bakeIntoRest` in
 * characterEngine.ts) -- that's how SIYA's arms hang naturally down instead
 * of a raw T-pose. `pose.addQuaternion(bone, delta)` then composes as
 * `rest * delta` every frame.
 *
 * SOMA's per-joint rotations are expressed relative to ITS OWN T-pose bind
 * (a standard mocap-skeleton convention: identity rotation == the T-pose
 * offset geometry). Feeding a SOMA rotation straight into `addQuaternion`
 * therefore composes as `(original_bind * basePose) * soma_from_T_pose`,
 * bending the limb by the arms-down correction AND by SOMA's own
 * (much larger, since it starts from a full T-pose) rotation -- a double
 * bend. That produced the contorted arm/hand seen on first test.
 *
 * Fix: cancel the baked-in basePose offset before applying SOMA's rotation,
 * so the net result is `original_bind * soma_from_T_pose` as intended:
 *   delta = inverse(basePoseQuat) * somaQuatToMmd(...)
 * Bones with no basePose entry (spine, neck, head, legs) need no correction
 * -- their rest is already the plain bind pose.
 */
export function buildBasePoseCorrections(
  basePose: Record<string, { x?: number; y?: number; z?: number }> | undefined,
): Map<string, THREE.Quaternion> {
  const corrections = new Map<string, THREE.Quaternion>();
  if (!basePose) return corrections;
  const euler = new THREE.Euler();
  for (const [mmdKey, angles] of Object.entries(basePose)) {
    euler.set(angles.x ?? 0, angles.y ?? 0, angles.z ?? 0, "XYZ");
    const baseQuat = new THREE.Quaternion().setFromEuler(euler);
    corrections.set(mmdKey, baseQuat.invert());
  }
  return corrections;
}

/**
 * Retarget one frame of a SOMA motion clip (flat [frames, joints, 4] and
 * [frames, 3] buffers, exactly as returned by the motion service) into a
 * per-bone quaternion map ready for CharacterEngine's pose accumulator
 * (`pose.addQuaternion(boneKey, quat, weight)`).
 *
 * `basePoseCorrections`: from buildBasePoseCorrections(config.basePose),
 * cached once per character (not per frame) by the caller.
 */
export function retargetFrame(
  rotationsXYZW: Float32Array,
  frameIndex: number,
  jointCount: number = SOMA30_JOINT_COUNT,
  basePoseCorrections?: Map<string, THREE.Quaternion>,
): RetargetedFrame {
  const bones = new Map<string, THREE.Quaternion>();
  const base = frameIndex * jointCount * 4;
  for (let joint = 0; joint < jointCount; joint++) {
    const somaName = SOMA30_NAMES[joint];
    if (!somaName) continue;
    const mmdKey = SOMA_TO_MMD_BONE[somaName];
    if (!mmdKey) continue;
    const o = base + joint * 4;
    const x = rotationsXYZW[o];
    const y = rotationsXYZW[o + 1];
    const z = rotationsXYZW[o + 2];
    const w = rotationsXYZW[o + 3];
    if (x === undefined || y === undefined || z === undefined || w === undefined) continue;
    const quat = somaQuatToMmd(x, y, z, w).clone();
    const correction = basePoseCorrections?.get(mmdKey);
    if (correction) quat.premultiply(correction);
    bones.set(mmdKey, quat);
  }
  return { bones };
}
