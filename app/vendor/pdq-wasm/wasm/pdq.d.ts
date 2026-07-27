declare function createPDQModule(opts: {
  wasmBinary: ArrayBuffer | Uint8Array;
}): Promise<Record<string, unknown>>;

export = createPDQModule;
export as namespace createPDQModule;
