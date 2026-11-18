declare module "@3d-dice/dice-box" {
  export default class DiceBox {
    constructor(config: Record<string, unknown>);
    init(): Promise<DiceBox>;
    clear(): DiceBox;
    hide(): void;
    show(): void;
    add(notation: string | { qty: number; sides: number }): Promise<Array<{ sides: number; value: number }>>;
    canvas: HTMLCanvasElement;
  }
}
declare module "@3d-dice/dice-parser-interface" {
  export default class DiceParser {
    parseNotation(formula: string): Array<{ qty: number; sides: number | string }>;
  }
}
