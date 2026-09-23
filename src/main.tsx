/*
 * Recovered from SIYA-Setup-1.0.1.exe (dist/assets/index-qnLjC2CG.js) —
 * this is the small bootstrap tail that was previously inlined at the very
 * end of the bundle (`Vx.createRoot(...).render(...)`), split out here as
 * its own entry module.
 */

import * as L from "react";
import { createRoot } from "react-dom/client";
import * as b from "react/jsx-runtime";
import { AppProviders } from "./App";
import { MainExperience } from "./components/MainExperience";
import { ConsentGate } from "./components/ConsentGate";
import { SafetyCard } from "./components/SafetyCard";
import { PrivacyCenter } from "./components/PrivacyCenter";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  b.jsx(L.StrictMode, {
    children: b.jsx(ConsentGate, {
      children: b.jsx(AppProviders, {
        children: [
          b.jsx(MainExperience, {}, "main"),
          b.jsx(SafetyCard, {}, "safety"),
          b.jsx(PrivacyCenter, {}, "privacy"),
        ],
      }),
    }),
  }),
);
