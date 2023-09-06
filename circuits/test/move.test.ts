const { wasm } = require("circom_tester");
import { assert } from "chai";
import { Player, Tile, Board, Location, Utils } from "../../game";

describe("move circuit", () => {
    it("fails if either of the nullifiers are invalid", async () => {
        const circuit = await wasm(
            "test/circuits/test_check_nullifiers.circom"
        );
        const t1 = Tile.genUnowned({ r: 0, c: 0 });
        const t2 = Tile.genUnowned({ r: 0, c: 1 });

        const w1 = await circuit.calculateWitness({
            keyFrom: t1.key.toString(),
            keyTo: t2.key.toString(),
            rhoFrom: t1.nullifier(),
            rhoTo: "123",
        }, true);
        // circom witness gen places circuit outputs at indices [1, n_outputs]
        assert.equal(w1[1], BigInt("0"));
        await circuit.checkConstraints(w1);

        const w2 = await circuit.calculateWitness(
            {
                keyFrom: t1.key.toString(),
                keyTo: t2.key.toString(),
                rhoFrom: t1.nullifier(),
                rhoTo: "123",
            },
            true
        );
        assert.equal(w2[1], BigInt("0"));
        await circuit.checkConstraints(w2);
    });

    it("passes if both nullifiers are valid", async () => {
        const circuit = await wasm(
            "test/circuits/test_check_nullifiers.circom"
        );
        const t1 = Tile.genUnowned({ r: 0, c: 0 });
        const t2 = Tile.genUnowned({ r: 0, c: 1 });

        const w = await circuit.calculateWitness(
            {
                keyFrom: t1.key.toString(),
                keyTo: t2.key.toString(),
                rhoFrom: t1.nullifier(),
                rhoTo: t2.nullifier(),
            },
            true
        );
        assert.equal(w[1], BigInt("1"));
        await circuit.checkConstraints(w);
    });
});
