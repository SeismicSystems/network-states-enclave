const wasmTester = require("circom_tester").wasm;

describe("move circuit", () => {
    let circuit;

    beforeEach(async () => {
        circuit = await wasmTester("move/move.circom");
    });

    it("should work on hello world", () => {
        console.log("hello world");
    });
});
