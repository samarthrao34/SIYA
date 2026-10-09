/*
 * SIYA's own avatar: an original VRoid character by Samarth (VRM 0.x),
 * loaded through vrmModelSource.ts. Everything not listed here (bone map,
 * idle/gaze/behaviour/lip-sync tuning, lighting, camera) is inherited from
 * the shared BASE_CHARACTER rig tuning, which works because the VRM loader
 * presents the VRoid skeleton under MMD bone names.
 */
import { BASE_CHARACTER } from "./characterEngine";

const base = BASE_CHARACTER as any;

export const SIYA_CHARACTER = {
  ...base,
  id: "siya",
  displayName: "SIYA",
  format: "vrm",
  modelUrl: "/assets/characters/siya/SIYA.vrm",
  textureMapUrl: null,
  // VRoid rests in a T-pose; the base rig rests 39.3 deg lower (0.686 rad), so
  // the arm offsets add that on top of the base pose.
  basePose: {
    ...base.basePose,
    armL: { z: -1.27, y: 0.1 },
    armR: { z: 1.27, y: -0.1 },
  },
  morphs: {
    blink: "Fcl_EYE_Close",
    blinkL: "Fcl_EYE_Close_L",
    blinkR: "Fcl_EYE_Close_R",
    smileEyes: "Fcl_EYE_Joy",
    eyesWideL: "Fcl_EYE_Surprised",
    eyesAngry: "Fcl_EYE_Angry",
    eyesSad: "Fcl_EYE_Sorrow",
    visemeA: "Fcl_MTH_A",
    visemeI: "Fcl_MTH_I",
    visemeU: "Fcl_MTH_U",
    visemeE: "Fcl_MTH_E",
    visemeO: "Fcl_MTH_O",
    visemeTalk: "Fcl_MTH_Large",
    mouthSmile: "Fcl_MTH_Fun",
    mouthCornerUpL: "Fcl_MTH_Up",
    mouthCornerDownL: "Fcl_MTH_Down",
    mouthNarrow: "Fcl_MTH_Small",
    browAngry: "Fcl_BRW_Angry",
    browSad: "Fcl_BRW_Sorrow",
    browUp: "Fcl_BRW_Surprised",
  },
  // vrmModelSource names each material by its role.
  materialRoles: {
    skin: ["skin"],
    face: ["face"],
    eyeWhite: ["eyeWhite"],
    iris: ["iris"],
    catchlight: ["catchlight"],
    lash: ["lash"],
    brow: ["brow"],
    mouth: ["mouth"],
    hair: ["hair"],
    cloth: ["cloth"],
  },
  materialTuning: {
    ...base.materialTuning,
    // The base skin tuning adds warmth for her palette; SIYA's VRoid skin
    // texture is already warm, so keep it closer to what VRoid shows.
    skin: { ...base.materialTuning.skin, warmth: 0.08, subsurfaceStrength: 0.15 },
    face: { ...base.materialTuning.face, warmth: 0.08, subsurfaceStrength: 0.15 },
    // VRoid cloth/hair are alpha cut-outs (MToon cutoff 0.5); blending their
    // soft texture borders draws dark halos around buttons, tassels and hems.
    cloth: { ...base.materialTuning.cloth, alphaTest: 0.5 },
    hair: { ...base.materialTuning.hair, alphaTest: 0.5 },
  },
  hiddenMaterials: [],
  // 40 fps is visually smooth for an idle/talking avatar and leaves headroom
  // on integrated GPUs, so rendering never starves audio playback.
  render: { ...base.render, targetFps: 40 },
  // The base thinking pose (hand to chin) folds a T-pose-rest arm up behind
  // the head. These were solved numerically so the right hand rests just in
  // front of the chin with the elbow in front of the body.
  gesturePoses: {
    // Idle "wave": solved so the hand is up at face height, out to her left
    // and in front, with the elbow bent below the shoulder.
    wave: {
      armL: [0.227, -0.783, 0.751],
      elbowL: [1.508, -0.531, 2.431],
    },
    // Idle "stretch": both hands up over the head (right arm mirrors left).
    stretch: {
      armL: [1.233, -0.237, 2.793],
      elbowL: [-0.41, -0.358, 0.323],
    },
    thinking: {
      armR: [-1.268, -0.269, 0.436],
      elbowR: [-0.382, -2.419, 0.551],
      wristR: [0.12, -0.16, -0.22],
    },
  },
  physics: {
    ...base.physics,
    groups: {
      hair: { ...base.physics.groups.hair, match: ["Hair"] },
      skirt: { ...base.physics.groups.coat, match: ["Skirt"] },
    },
  },
};
