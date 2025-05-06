declare module '@biowasm/aioli' {
  class Aioli {
    constructor(tools: string[]);
    mount(options: { name: string; data: string }): Promise<void>;
    exec(command: string): Promise<any>;
    cat(filename: string): Promise<string>;
    // Add any other methods used or known
  }
  export default Aioli;
}
