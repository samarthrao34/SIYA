# SIYA — original Three.js avatar

The app uses the original recovered avatar and Three.js character engine.

- Model: `public/assets/characters/evelyn/model.pmx`
- Textures: `public/assets/characters/evelyn/textures/` and `textures.json`
- Renderer and animation: `src/character/characterEngine.ts`
- React integration: `src/character/CharacterStage.tsx`

The `evelyn` asset name is retained from the original application.
The alternate GLB/Blender avatar and 2D avatar assets have been removed.

Run `npm run dev` for development, or `npm run build` to rebuild the desktop UI and server.
Run `npm run typecheck:frontend` to check the frontend.
