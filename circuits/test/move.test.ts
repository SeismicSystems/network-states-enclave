const { wasm } = require("circom_tester");
import { assert } from "chai";
import { Player, Tile, Board, Location, Utils } from "../../game";

describe("Unit tests for CheckNullifiers()", () => {
    let circuit;

    beforeEach(async () => {
        circuit = await wasm(
            "test/circuits/test_check_nullifiers.circom"
        );
    })

    it("fails if either of the nullifiers are invalid", async () => {
        const t1 = Tile.genUnowned({ r: 0, c: 0 });
        const t2 = Tile.genUnowned({ r: 0, c: 1 });

        const w1 = await circuit.calculateWitness(
            {
                keyFrom: t1.key.toString(),
                keyTo: t2.key.toString(),
                rhoFrom: t1.nullifier(),
                rhoTo: "123",
            },
            true
        );
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

describe("Unit tests for CheckLeaves()", () => {
    let circuit;

    beforeEach(async () => {
        circuit = await wasm(
            "test/circuits/test_check_leaves.circom"
        );
    })

    it("fails if player tries to move troops they don't own", async () => {
        const p1 = new Player("A", BigInt("0xfff"));
        const p2 = new Player("B", BigInt("0xddd"));
        const t1 = Tile.genOwned(p1, {r: 0, c: 0}, 9);
        const t2 = Tile.genOwned(p1, {r: 0, c: 0}, 9);

        const w = await circuit.calculateWitness(
            {
                uFrom: t1.toCircuitInput(),
                uTo: t2.toCircuitInput(),
                hUFrom: t1.hash(),
                hUTo: t2.hash(),
                privKeyHash: p2.bjjPrivHash,
            },
            true
        );
        assert.equal(w[1], BigInt("0"));
        await circuit.checkConstraints(w);
    });

    it("fails if proposed hashes don't match the new", async () => {
        const p1 = new Player("A", BigInt("0xfff"));
        const p2 = new Player("B", BigInt("0xddd"));
        const t1 = Tile.genOwned(p1, {r: 0, c: 0}, 9);
        const t2 = Tile.genOwned(p2, {r: 0, c: 0}, 9);

        const w1 = await circuit.calculateWitness(
            {
                uFrom: t1.toCircuitInput(),
                uTo: t2.toCircuitInput(),
                hUFrom: "123",
                hUTo: t2.hash(),
                privKeyHash: p2.bjjPrivHash,
            },
            true
        );
        assert.equal(w1[1], BigInt("0"));
        await circuit.checkConstraints(w1);

        const w2 = await circuit.calculateWitness(
            {
                uFrom: t1.toCircuitInput(),
                uTo: t2.toCircuitInput(),
                hUFrom: t1.hash(),
                hUTo: "123",
                privKeyHash: p2.bjjPrivHash,
            },
            true
        );
        assert.equal(w2[1], BigInt("0"));
        await circuit.checkConstraints(w2);
    });

    it("passes if move initiated by new owner & new hashes valid", async () => {

    });
});
