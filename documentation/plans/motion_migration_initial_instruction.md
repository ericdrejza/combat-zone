You are the Lead Architecture Coordinator Agent. We are migrating our graphics 
rendering from native React SVGs utilizing TypeScript 
typings (like React.SVGProps<SVGCircleElement>) to the React Motion package.

Because we are working with SVGs, adhere strictly to these constraints:
1. Do not apply layout or layoutId directly to SVG geometry primitive
child tags (e.g., <motion.circle>, <motion.path>). If Layout migrations are 
required, wrap the parent elements in a <motion.div>.
2. Translate standard positional props (cx, cy, r, strokeDasharray) into Motion-managed declarative animation tracks.
3. Map existing React element props securely while preserving our existing TypeScript types.
4. Eliminate duplicate event handlers and old movement logic that would conflict with Motion.
   1. Use built-in Motion hooks/handlers
5. All movement must use motion
   1. All automatic movement must use Motion paths and animation frames for the moving element
      1. e.g. An actor moves from a dropped position to the position calculated by layout logic
         1. action should slide from one point to another, not blink out and then back in.
   2. All manual movement must use Motion Drag gesture

Your goal is to orchestrate this migration across our available sub-agents using a multi-step approach:
- Step 1: Spawn Analysis Agent (Luna - high) to analyze the attached SVG-based component files under `src/ui/canvas/` and identify what states dictate the movement.
- Step 2: Use Analysis Agent (Luna) to anaylyze Motion documentation `https://motion.dev/docs/react` and extract information pertinent to this project; add this information to `plans/motion_migration_2.md` and if questions come up during implementation do more research as needed.  Only read the installed motion code under node_modules if you need to / can't find it on the website.
- Step 3: Build a map translating those dynamic variables to motion variants.  Output this map and and any other useful information to `plans/motion_migration_2.md`.
- Step 4: Spawn and direct the Support Agent (Luna - high) to update svg elements to use motion instead; e.g. from <circle> to <motion.circle>.
- Step 5: Direct the Support Agent (Luna) to verify TypeScript prop typings remain clean and non-redundant.
- Step 6: Spawn and direct the Implementation Agent (Sol - medium) to update the components and all of their logic to use Motion

Actor migration to use Motion has already been started.  It is not done, so keep working on it.

Clearly separate your notes in `plans/motion_migration_2.md` into phases:
1. Planning (what you learned while planning)
2. Implementation (what you learned while implementing) 

Add the end of this process, we should have the Canvas, Actors, and Zones implemented using Motion principles / methodology.
We should also have a robust `plans/motion_migration_2.md` that will document the focus points and findings of this migration effort so if it needs to be redone, it can with less token spend on research.

Do not read or write `plans/motion_migration.md`.