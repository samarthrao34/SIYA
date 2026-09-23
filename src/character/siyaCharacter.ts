/*
 * SIYA's own avatar: an original VRoid character by Samarth (VRM 0.x),
 * loaded through vrmModelSource.ts. Everything not listed here (bone map,
 * idle/gaze/behaviour/lip-sync tuning, lighting, camera) is inherited from
 * Evelyn's tuned config, which works because the VRM loader presents the
 * VRoid skeleton under the same MMD bone names.
 */
import { EVELYN_CHARACTER } from "./characterEngine";

const evelyn = EVELYN_CHARACTER as any;

export const SIYA_CHARACTER = {
  ...evelyn,
  id: "siya",
  displayName: "SIYA",
  format: "vrm",
  modelUrl: "/assets/characters/siya/SIYA.vrm",
  textureMapUrl: null,
  // VRoid rests in a T-pose; Evelyn rests 39.3 deg lower (0.686 rad), so the
  // arm offsets add that on top of Evelyn's own base pose.
  basePose: {
    ...evelyn.basePose,
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
    ...evelyn.materialTuning,
    // Evelyn's skin tuning adds warmth for her palette; SIYA's VRoid skin
    // texture is already warm, so keep it closer to what VRoid shows.
    skin: { ...evelyn.materialTuning.skin, warmth: 0.08, subsurfaceStrength: 0.15 },
    face: { ...evelyn.materialTuning.face, warmth: 0.08, subsurfaceStrength: 0.15 },
    // VRoid cloth/hair are alpha cut-outs (MToon cutoff 0.5); blending their
    // soft texture borders draws dark halos around buttons, tassels and hems.
    cloth: { ...evelyn.materialTuning.cloth, alphaTest: 0.5 },
    hair: { ...evelyn.materialTuning.hair, alphaTest: 0.5 },
  },
  hiddenMaterials: [],
  // Evelyn's thinking pose (hand to chin) folds a T-pose-rest arm up behind
  // the head. These were solved numerically so the right hand rests just in
  // front of the chin with the elbow in front of the body.
  gesturePoses: {
    thinking: {
      armR: [-1.268, -0.269, 0.436],
      elbowR: [-0.382, -2.419, 0.551],
      wristR: [0.12, -0.16, -0.22],
    },
  },
  physics: {
    ...evelyn.physics,
    groups: {
      hair: { ...evelyn.physics.groups.hair, match: ["Hair"] },
      skirt: { ...evelyn.physics.groups.coat, match: ["Skirt"] },
    },
  },
};
