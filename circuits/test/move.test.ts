const { wasm } = require("circom_tester");
import { assert } from "chai";
import { Player, Tile, Board, Location, Utils } from "../../game";

describe("Unit tests for CheckNullifiers()", () => {
    let circuit;

    beforeEach(async () => {
        circuit = await wasm("test/circuits/test_check_nullifiers.circom");
    });

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
        circuit = await wasm("test/circuits/test_check_leaves.circom");
    });

    it("fails if player tries to move troops they don't own", async () => {
        const p1 = new Player("A", BigInt("0xfff"));
        const p2 = new Player("B", BigInt("0xddd"));
        const t1 = Tile.genOwned(p1, { r: 0, c: 0 }, 9);
        const t2 = Tile.genOwned(p1, { r: 0, c: 0 }, 9);

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
        const t1 = Tile.genOwned(p1, { r: 0, c: 0 }, 9);
        const t2 = Tile.genOwned(p2, { r: 0, c: 0 }, 9);

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

    it("passes if move initiated by owner & new hashes valid", async () => {
        const p1 = new Player("A", BigInt("0xfff"));
        const p2 = new Player("B", BigInt("0xddd"));
        const t1 = Tile.genOwned(p1, { r: 0, c: 0 }, 9);
        const t2 = Tile.genOwned(p2, { r: 0, c: 0 }, 9);

        const w = await circuit.calculateWitness(
            {
                uFrom: t1.toCircuitInput(),
                uTo: t2.toCircuitInput(),
                hUFrom: t1.hash(),
                hUTo: t2.hash(),
                privKeyHash: p1.bjjPrivHash,
            },
            true
        );
        assert.equal(w[1], BigInt("1"));
        await circuit.checkConstraints(w);
    });
});

describe("Unit tests for CheckStep()", () => {
    let circuit;

    beforeEach(async () => {
        circuit = await wasm("test/circuits/test_check_step.circom");
    });

    it("fails if player tries to move diagonally", async () => {
        const t1 = Tile.genUnowned({ r: 0, c: 0 });
        const t2 = Tile.genUnowned({ r: 1, c: 1 });

        const u1 = Tile.genUnowned({ r: 0, c: 0 });
        const u2 = Tile.genUnowned({ r: 1, c: 1 });

        const w = await circuit.calculateWitness(
            {
                tFrom: t1.toCircuitInput(),
                tTo: t2.toCircuitInput(),
                uFrom: u1.toCircuitInput(),
                uTo: u2.toCircuitInput(),
            },
            true
        );
        assert.equal(w[1], BigInt("0"));
        await circuit.checkConstraints(w);
    });

    it("fails if player swaps locations during update", async () => {
        const t1 = Tile.genUnowned({ r: 81, c: 30 });
        const t2 = Tile.genUnowned({ r: 81, c: 29 });

        const u1 = Tile.genUnowned({ r: 5, c: 5 });
        const u2 = Tile.genUnowned({ r: 81, c: 29 });

        const w = await circuit.calculateWitness(
            {
                tFrom: t1.toCircuitInput(),
                tTo: t2.toCircuitInput(),
                uFrom: u1.toCircuitInput(),
                uTo: u2.toCircuitInput(),
            },
            true
        );
        assert.equal(w[1], BigInt("0"));
        await circuit.checkConstraints(w);
    });

    it("fails if player tries to move in place", async () => {
        const t1 = Tile.genUnowned({ r: 0, c: 0 });
        const t2 = Tile.genUnowned({ r: 0, c: 0 });

        const u1 = Tile.genUnowned({ r: 0, c: 0 });
        const u2 = Tile.genUnowned({ r: 0, c: 0 });

        const w = await circuit.calculateWitness(
            {
                tFrom: t1.toCircuitInput(),
                tTo: t2.toCircuitInput(),
                uFrom: u1.toCircuitInput(),
                uTo: u2.toCircuitInput(),
            },
            true
        );
        assert.equal(w[1], BigInt("0"));
        await circuit.checkConstraints(w);
    });

    it("passes if state updated in unit cardinal plane", async () => {
        const t1 = Tile.genUnowned({ r: 12, c: 15 });
        const t2 = Tile.genUnowned({ r: 11, c: 15 });

        const u1 = Tile.genUnowned({ r: 12, c: 15 });
        const u2 = Tile.genUnowned({ r: 11, c: 15 });

        const w = await circuit.calculateWitness(
            {
                tFrom: t1.toCircuitInput(),
                tTo: t2.toCircuitInput(),
                uFrom: u1.toCircuitInput(),
                uTo: u2.toCircuitInput(),
            },
            true
        );
        assert.equal(w[1], BigInt("1"));
        await circuit.checkConstraints(w);
    });
});

describe("Unit tests for CheckRsrc()", () => {
    let circuit;

    beforeEach(async () => {
        circuit = await wasm("test/circuits/test_check_rsrc.circom");
    });

    it("fails if player moves all troops out of a tile", async () => {
        const p = new Player("A", BigInt("0xfff"));
        const t1 = Tile.genOwned(p, { r: 123, c: 321 }, 9);
        const t2 = Tile.genUnowned({ r: 124, c: 321 });
        const u1 = Tile.genOwned(p, { r: 123, c: 321 }, 0);
        const u2 = Tile.genOwned(p, { r: 124, c: 321 }, 9);

        const w = await circuit.calculateWitness(
            {
                tFrom: t1.toCircuitInput(),
                tTo: t2.toCircuitInput(),
                uFrom: u1.toCircuitInput(),
                uTo: u2.toCircuitInput(),
            },
            true
        );
        assert.equal(w[1], BigInt("0"));
        await circuit.checkConstraints(w);
    });

    it("fails if player invents troops out of thin air, case 1", async () => {
        const p = new Player("A", BigInt("0xfff"));
        const t1 = Tile.genOwned(p, { r: 123, c: 321 }, 3);
        const t2 = Tile.genUnowned({ r: 124, c: 321 });
        const u1 = Tile.genOwned(p, { r: 123, c: 321 }, 3);
        const u2 = Tile.genOwned(p, { r: 124, c: 321 }, 2);

        const w = await circuit.calculateWitness(
            {
                tFrom: t1.toCircuitInput(),
                tTo: t2.toCircuitInput(),
                uFrom: u1.toCircuitInput(),
                uTo: u2.toCircuitInput(),
            },
            true
        );
        assert.equal(w[1], BigInt("0"));
        await circuit.checkConstraints(w);
    });

    it("fails if player invents troops out of thin air, case 2", async () => {
        const p1 = new Player("A", BigInt("0xfff"));
        const p2 = new Player("B", BigInt("0xddd"));
        const t1 = Tile.genOwned(p1, { r: 123, c: 321 }, 9);
        const t2 = Tile.genOwned(p2, { r: 124, c: 321 }, 3);
        const u1 = Tile.genOwned(p1, { r: 123, c: 321 }, 1);
        const u2 = Tile.genOwned(p1, { r: 124, c: 321 }, 11);

        const w = await circuit.calculateWitness(
            {
                tFrom: t1.toCircuitInput(),
                tTo: t2.toCircuitInput(),
                uFrom: u1.toCircuitInput(),
                uTo: u2.toCircuitInput(),
            },
            true
        );
        assert.equal(w[1], BigInt("0"));
        await circuit.checkConstraints(w);
    });

    it("fails if player claims to capture with fewer resources", async () => {
        const p1 = new Player("A", BigInt("0xfff"));
        const p2 = new Player("B", BigInt("0xddd"));
        const t1 = Tile.genOwned(p1, { r: 123, c: 321 }, 3);
        const t2 = Tile.genOwned(p2, { r: 124, c: 321 }, 9);
        const u1 = Tile.genOwned(p1, { r: 123, c: 321 }, 1);
        const u2 = Tile.genOwned(p1, { r: 124, c: 321 }, 2);

        const w = await circuit.calculateWitness(
            {
                tFrom: t1.toCircuitInput(),
                tTo: t2.toCircuitInput(),
                uFrom: u1.toCircuitInput(),
                uTo: u2.toCircuitInput(),
            },
            true
        );
        assert.equal(w[1], BigInt("0"));
        await circuit.checkConstraints(w);
    });

    it("fails if player doesn't capture unowned tile when they should", async () => {
        const p1 = new Player("A", BigInt("0xfff"));
        const t1 = Tile.genOwned(p1, { r: 123, c: 321 }, 5);
        const t2 = Tile.genUnowned({ r: 124, c: 321 });
        const u1 = Tile.genOwned(p1, { r: 123, c: 321 }, 2);
        const u2 = Tile.genUnowned({ r: 124, c: 321 });

        const w = await circuit.calculateWitness(
            {
                tFrom: t1.toCircuitInput(),
                tTo: t2.toCircuitInput(),
                uFrom: u1.toCircuitInput(),
                uTo: u2.toCircuitInput(),
            },
            true
        );
        assert.equal(w[1], BigInt("0"));
        await circuit.checkConstraints(w);
    });

    it("fails if player doesn't capture enemy tile when they should", async () => {
        const p1 = new Player("A", BigInt("0xfff"));
        const p2 = new Player("B", BigInt("0xddd"));
        const t1 = Tile.genOwned(p1, { r: 123, c: 321 }, 5);
        const t2 = Tile.genOwned(p2, { r: 124, c: 321 }, 2);
        const u1 = Tile.genOwned(p1, { r: 123, c: 321 }, 2);
        const u2 = Tile.genOwned(p2, { r: 124, c: 321 }, 1);

        const w = await circuit.calculateWitness(
            {
                tFrom: t1.toCircuitInput(),
                tTo: t2.toCircuitInput(),
                uFrom: u1.toCircuitInput(),
                uTo: u2.toCircuitInput(),
            },
            true
        );
        assert.equal(w[1], BigInt("0"));
        await circuit.checkConstraints(w);
    });

    it("passes if resource management rules hold, taking unowned", async () => {
        const p = new Player("A", BigInt("0xfff"));
        const t1 = Tile.genOwned(p, { r: 123, c: 321 }, 9);
        const t2 = Tile.genUnowned({ r: 124, c: 321 });
        const u1 = Tile.genOwned(p, { r: 123, c: 321 }, 2);
        const u2 = Tile.genOwned(p, { r: 124, c: 321 }, 7);

        const w = await circuit.calculateWitness(
            {
                tFrom: t1.toCircuitInput(),
                tTo: t2.toCircuitInput(),
                uFrom: u1.toCircuitInput(),
                uTo: u2.toCircuitInput(),
            },
            true
        );
        assert.equal(w[1], BigInt("1"));
        await circuit.checkConstraints(w);
    });

    it("passes if resource management rules hold, battling enemy", async () => {
        const p1 = new Player("A", BigInt("0xfff"));
        const p2 = new Player("B", BigInt("0xddd"));
        const t1 = Tile.genOwned(p1, { r: 123, c: 321 }, 15);
        const t2 = Tile.genOwned(p2, { r: 124, c: 321 }, 33);
        const u1 = Tile.genOwned(p1, { r: 123, c: 321 }, 10);
        const u2 = Tile.genOwned(p2, { r: 124, c: 321 }, 28);

        const w = await circuit.calculateWitness(
            {
                tFrom: t1.toCircuitInput(),
                tTo: t2.toCircuitInput(),
                uFrom: u1.toCircuitInput(),
                uTo: u2.toCircuitInput(),
            },
            true
        );
        assert.equal(w[1], BigInt("1"));
        await circuit.checkConstraints(w);
    });

    it("passes if resource management rules hold, taking enemy", async () => {
        const p1 = new Player("A", BigInt("0xfff"));
        const p2 = new Player("B", BigInt("0xddd"));
        const t1 = Tile.genOwned(p1, { r: 123, c: 321 }, 33);
        const t2 = Tile.genOwned(p2, { r: 124, c: 321 }, 15);
        const u1 = Tile.genOwned(p1, { r: 123, c: 321 }, 3);
        const u2 = Tile.genOwned(p1, { r: 124, c: 321 }, 15);
        
        const w = await circuit.calculateWitness(
            {
                tFrom: t1.toCircuitInput(),
                tTo: t2.toCircuitInput(),
                uFrom: u1.toCircuitInput(),
                uTo: u2.toCircuitInput(),
            },
            true
        );
        assert.equal(w[1], BigInt("1"));
        await circuit.checkConstraints(w);
    });
});

describe("Unit tests for CheckMerkleInclusion()", () => {
    let circuit;

    beforeEach(async () => {
        circuit = await wasm("test/circuits/test_check_merkle.circom");
    });

    it("passes if both tiles are in the merkle root", async () => {
        let tree = Utils.newTree(8);

        const p1 = new Player("A", BigInt("0xfff"));
        const p2 = new Player("B", BigInt("0xddd"));
        const t1 = Tile.genOwned(p1, { r: 123, c: 321 }, 10);
        const t2 = Tile.genOwned(p2, { r: 124, c: 321 }, 10);

        tree.insert(Utils.intoBigNumber(t1.hash()));
        tree.insert(Utils.intoBigNumber(t2.hash()));

        const mp1 = Utils.generateMerkleProof(t1.hash(), tree);
        const mp2 = Utils.generateMerkleProof(t2.hash(), tree);

        const w = await circuit.calculateWitness(
            {
                root: tree.root,
                tFrom: t1.toCircuitInput(),
                tFromPathIndices: mp1.indices,
                tFromPathElements: mp1.pathElements,
                tTo: t2.toCircuitInput(),
                tToPathIndices: mp2.indices,
                tToPathElements: mp2.pathElements,
            },
            true
        );
        assert.equal(w[1], BigInt("1"));
        await circuit.checkConstraints(w);
    });

    it("fails if the from tile is not in the merkle root", async () => {
        let tree = Utils.newTree(8);

        const p1 = new Player("A", BigInt("0xfff"));
        const p2 = new Player("B", BigInt("0xddd"));
        const t1 = Tile.genOwned(p1, { r: 123, c: 321 }, 10);
        const t2 = Tile.genOwned(p2, { r: 124, c: 321 }, 10);

        tree.insert(Utils.intoBigNumber(t1.hash()));

        const mp1 = Utils.generateMerkleProof(t1.hash(), tree);
        const mp2 = mp1; // Can't generate a valid proof for t2, so we try mp1

        const w = await circuit.calculateWitness(
            {
                root: tree.root,
                tFrom: t1.toCircuitInput(),
                tFromPathIndices: mp1.indices,
                tFromPathElements: mp1.pathElements,
                tTo: t2.toCircuitInput(),
                tToPathIndices: mp2.indices,
                tToPathElements: mp2.pathElements,
            },
            true
        );
        assert.equal(w[1], BigInt("0"));
        await circuit.checkConstraints(w);
    });

    it("fails if the to tile is not in the merkle root", async () => {
        let tree = Utils.newTree(8);

        const p1 = new Player("A", BigInt("0xfff"));
        const p2 = new Player("B", BigInt("0xddd"));
        const t1 = Tile.genOwned(p1, { r: 123, c: 321 }, 10);
        const t2 = Tile.genOwned(p2, { r: 124, c: 321 }, 10);

        tree.insert(Utils.intoBigNumber(t1.hash()));

        const mp1 = Utils.generateMerkleProof(t1.hash(), tree);
        const mp2 = mp1;

        const w = await circuit.calculateWitness(
            {
                root: tree.root,
                tFrom: t1.toCircuitInput(),
                tFromPathIndices: mp2.indices,
                tFromPathElements: mp2.pathElements,
                tTo: t2.toCircuitInput(),
                tToPathIndices: mp1.indices,
                tToPathElements: mp1.pathElements,
            },
            true
        );
        assert.equal(w[1], BigInt("0"));
        await circuit.checkConstraints(w);
    });
});
