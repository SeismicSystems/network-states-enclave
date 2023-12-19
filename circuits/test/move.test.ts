const { wasm } = require("circom_tester");
import { assert } from "chai";

import { Player, TerrainUtils, Tile } from "../../game";

let terrainUtils = new TerrainUtils(2, 2, 19, 18, 17);

describe("Unit tests for CheckTileHash()", () => {
    let circuit;

    beforeEach(async () => {
        circuit = await wasm("test/circuits/test_check_tile_hash.circom");
    });

    it("fails if tile and tile hash do not correspond", async () => {
        const t = Tile.water({ r: 0, c: 0 }, BigInt(0));

        const w = await circuit.calculateWitness({
            tileHash: "0",
            tile: t.toCircuitInput(),
        });
        assert.equal(w[1], BigInt(0));
        await circuit.checkConstraints(w);
    });

    it("passes if tile and tile hash correspond", async () => {
        const t = Tile.water({ r: 0, c: 0 }, BigInt(0));

        const w = await circuit.calculateWitness({
            tileHash: t.hash(),
            tile: t.toCircuitInput(),
        });
        assert.equal(w[1], BigInt(1));
        await circuit.checkConstraints(w);
    });
});

describe("Unit tests for CheckStep()", () => {
    let circuit;

    beforeEach(async () => {
        circuit = await wasm("test/circuits/test_check_step.circom");
    });

    it("fails if tFrom.r != uFrom.r", async () => {
        const tFrom = Tile.genVirtual(
            { r: 10, c: 10 },
            BigInt(0),
            terrainUtils
        );
        const tTo = Tile.genVirtual({ r: 10, c: 11 }, BigInt(0), terrainUtils);
        const uFrom = Tile.genVirtual({ r: 9, c: 10 }, BigInt(0), terrainUtils);
        const uTo = Tile.genVirtual({ r: 10, c: 11 }, BigInt(0), terrainUtils);

        const w = await circuit.calculateWitness({
            tFrom: tFrom.toCircuitInput(),
            tTo: tTo.toCircuitInput(),
            uFrom: uFrom.toCircuitInput(),
            uTo: uTo.toCircuitInput(),
        });
        assert.equal(w[1], BigInt(0));
        await circuit.checkConstraints(w);
    });

    it("fails if tFrom.c != uFrom.c", async () => {
        const tFrom = Tile.genVirtual(
            { r: 10, c: 10 },
            BigInt(0),
            terrainUtils
        );
        const tTo = Tile.genVirtual({ r: 10, c: 11 }, BigInt(0), terrainUtils);
        const uFrom = Tile.genVirtual({ r: 10, c: 9 }, BigInt(0), terrainUtils);
        const uTo = Tile.genVirtual({ r: 10, c: 11 }, BigInt(0), terrainUtils);

        const w = await circuit.calculateWitness({
            tFrom: tFrom.toCircuitInput(),
            tTo: tTo.toCircuitInput(),
            uFrom: uFrom.toCircuitInput(),
            uTo: uTo.toCircuitInput(),
        });
        assert.equal(w[1], BigInt(0));
        await circuit.checkConstraints(w);
    });

    it("fails if tTo.r != uTo.r", async () => {
        const tFrom = Tile.genVirtual(
            { r: 10, c: 10 },
            BigInt(0),
            terrainUtils
        );
        const tTo = Tile.genVirtual({ r: 10, c: 11 }, BigInt(0), terrainUtils);
        const uFrom = Tile.genVirtual(
            { r: 10, c: 10 },
            BigInt(0),
            terrainUtils
        );
        const uTo = Tile.genVirtual({ r: 9, c: 11 }, BigInt(0), terrainUtils);

        const w = await circuit.calculateWitness({
            tFrom: tFrom.toCircuitInput(),
            tTo: tTo.toCircuitInput(),
            uFrom: uFrom.toCircuitInput(),
            uTo: uTo.toCircuitInput(),
        });
        assert.equal(w[1], BigInt(0));
        await circuit.checkConstraints(w);
    });

    it("fails if tTo.c != uTo.c", async () => {
        const tFrom = Tile.genVirtual(
            { r: 10, c: 10 },
            BigInt(0),
            terrainUtils
        );
        const tTo = Tile.genVirtual({ r: 10, c: 11 }, BigInt(0), terrainUtils);
        const uFrom = Tile.genVirtual(
            { r: 10, c: 10 },
            BigInt(0),
            terrainUtils
        );
        const uTo = Tile.genVirtual({ r: 10, c: 12 }, BigInt(0), terrainUtils);

        const w = await circuit.calculateWitness({
            tFrom: tFrom.toCircuitInput(),
            tTo: tTo.toCircuitInput(),
            uFrom: uFrom.toCircuitInput(),
            uTo: uTo.toCircuitInput(),
        });
        assert.equal(w[1], BigInt(0));
        await circuit.checkConstraints(w);
    });

    it("fails if tFrom and tTo are not 1 tile away", async () => {
        const tFrom = Tile.genVirtual(
            { r: 10, c: 10 },
            BigInt(0),
            terrainUtils
        );
        const tTo = Tile.genVirtual({ r: 10, c: 12 }, BigInt(0), terrainUtils);
        const uFrom = Tile.genVirtual(
            { r: 10, c: 10 },
            BigInt(0),
            terrainUtils
        );
        const uTo = Tile.genVirtual({ r: 10, c: 12 }, BigInt(0), terrainUtils);

        const w = await circuit.calculateWitness({
            tFrom: tFrom.toCircuitInput(),
            tTo: tTo.toCircuitInput(),
            uFrom: uFrom.toCircuitInput(),
            uTo: uTo.toCircuitInput(),
        });
        assert.equal(w[1], BigInt(0));
        await circuit.checkConstraints(w);
    });

    it("fails if tTo is a hill tile", async () => {
        const tFrom = Tile.genVirtual(
            { r: 10, c: 10 },
            BigInt(0),
            terrainUtils
        );
        const tTo = Tile.hill({ r: 10, c: 11 }, BigInt(0));
        const uFrom = Tile.genVirtual(
            { r: 10, c: 10 },
            BigInt(0),
            terrainUtils
        );
        const uTo = Tile.hill({ r: 10, c: 11 }, BigInt(0));

        const w = await circuit.calculateWitness({
            tFrom: tFrom.toCircuitInput(),
            tTo: tTo.toCircuitInput(),
            uFrom: uFrom.toCircuitInput(),
            uTo: uTo.toCircuitInput(),
        });
        assert.equal(w[1], BigInt(0));
        await circuit.checkConstraints(w);
    });

    it("passes if tFrom to uTo is a valid step", async () => {
        const tFrom = Tile.genVirtual(
            { r: 10, c: 10 },
            BigInt(0),
            terrainUtils
        );
        const tTo = Tile.genVirtual({ r: 10, c: 11 }, BigInt(0), terrainUtils);
        const uFrom = Tile.genVirtual(
            { r: 10, c: 10 },
            BigInt(0),
            terrainUtils
        );
        const uTo = Tile.genVirtual({ r: 10, c: 11 }, BigInt(0), terrainUtils);

        const w = await circuit.calculateWitness({
            tFrom: tFrom.toCircuitInput(),
            tTo: tTo.toCircuitInput(),
            uFrom: uFrom.toCircuitInput(),
            uTo: uTo.toCircuitInput(),
        });
        assert.equal(w[1], BigInt(1));
        await circuit.checkConstraints(w);
    });
});

describe("Unit tests for CheckRsrc()", () => {
    let circuit;

    beforeEach(async () => {
        circuit = await wasm("test/circuits/test_check_rsrc.circom");
    });

    it("fails if all troops are moved", async () => {
        const p1 = new Player("A", "");
        const l1 = { r: 0, c: 0 };
        const p2 = new Player("B", "");
        const l2 = { r: 1, c: 0 };

        const w = await circuit.calculateWitness({
            currentWaterInterval: "0",
            ontoSelfOrUnowned: "0",
            fromCityTroops: "10",
            toCityTroops: "5",
            tFrom: new Tile(
                p1,
                l1,
                10,
                BigInt(0),
                1,
                0,
                Tile.BARE_TILE
            ).toCircuitInput(),
            tTo: new Tile(
                p2,
                l2,
                5,
                BigInt(0),
                2,
                0,
                Tile.BARE_TILE
            ).toCircuitInput(),
            uFrom: new Tile(
                p1,
                l1,
                0,
                BigInt(0),
                1,
                0,
                Tile.BARE_TILE
            ).toCircuitInput(),
            uTo: new Tile(
                p2,
                l2,
                5,
                BigInt(0),
                1,
                0,
                Tile.BARE_TILE
            ).toCircuitInput(),
            fromUpdatedTroops: "10",
            toUpdatedTroops: "5",
            ontoMoreOrEq: "0",
        });
        assert.equal(w[1], BigInt(0));
        await circuit.checkConstraints(w);
    });

    it("fails if more troops are moved than available", async () => {
        const p1 = new Player("A", "");
        const l1 = { r: 0, c: 0 };
        const p2 = new Player("B", "");
        const l2 = { r: 1, c: 0 };

        const w = await circuit.calculateWitness({
            currentWaterInterval: "0",
            ontoSelfOrUnowned: "0",
            fromCityTroops: "10",
            toCityTroops: "5",
            tFrom: new Tile(
                p1,
                l1,
                10,
                BigInt(0),
                1,
                0,
                Tile.BARE_TILE
            ).toCircuitInput(),
            tTo: new Tile(
                p2,
                l2,
                5,
                BigInt(0),
                2,
                0,
                Tile.BARE_TILE
            ).toCircuitInput(),
            uFrom: new Tile(
                p1,
                l1,
                0,
                BigInt(0),
                1,
                0,
                Tile.BARE_TILE
            ).toCircuitInput(),
            uTo: new Tile(
                p2,
                l2,
                20,
                BigInt(0),
                1,
                0,
                Tile.BARE_TILE
            ).toCircuitInput(),
            fromUpdatedTroops: "10",
            toUpdatedTroops: "5",
            ontoMoreOrEq: "0",
        });
        assert.equal(w[1], BigInt(0));
        await circuit.checkConstraints(w);
    });

    it("fails if tFrom and uFrom have different terrain types", async () => {
        const p1 = new Player("A", "");
        const l1 = { r: 0, c: 0 };
        const p2 = new Player("B", "");
        const l2 = { r: 1, c: 0 };

        const w = await circuit.calculateWitness({
            currentWaterInterval: "0",
            ontoSelfOrUnowned: "0",
            fromCityTroops: "10",
            toCityTroops: "5",
            tFrom: new Tile(
                p1,
                l1,
                10,
                BigInt(0),
                1,
                0,
                Tile.BARE_TILE
            ).toCircuitInput(),
            tTo: new Tile(
                p2,
                l2,
                5,
                BigInt(0),
                2,
                0,
                Tile.BARE_TILE
            ).toCircuitInput(),
            uFrom: new Tile(
                p1,
                l1,
                9,
                BigInt(0),
                1,
                0,
                Tile.WATER_TILE
            ).toCircuitInput(),
            uTo: new Tile(
                p2,
                l2,
                4,
                BigInt(0),
                1,
                0,
                Tile.BARE_TILE
            ).toCircuitInput(),
            fromUpdatedTroops: "10",
            toUpdatedTroops: "5",
            ontoMoreOrEq: "0",
        });
        assert.equal(w[1], BigInt(0));
        await circuit.checkConstraints(w);
    });

    it("fails if tTo and uTo have different terrain types", async () => {
        const p1 = new Player("A", "");
        const l1 = { r: 0, c: 0 };
        const p2 = new Player("B", "");
        const l2 = { r: 1, c: 0 };

        const w = await circuit.calculateWitness({
            currentWaterInterval: "0",
            ontoSelfOrUnowned: "0",
            fromCityTroops: "10",
            toCityTroops: "5",
            tFrom: new Tile(
                p1,
                l1,
                10,
                BigInt(0),
                1,
                0,
                Tile.BARE_TILE
            ).toCircuitInput(),
            tTo: new Tile(
                p2,
                l2,
                5,
                BigInt(0),
                2,
                0,
                Tile.BARE_TILE
            ).toCircuitInput(),
            uFrom: new Tile(
                p1,
                l1,
                9,
                BigInt(0),
                1,
                0,
                Tile.BARE_TILE
            ).toCircuitInput(),
            uTo: new Tile(
                p2,
                l2,
                4,
                BigInt(0),
                1,
                0,
                Tile.WATER_TILE
            ).toCircuitInput(),
            fromUpdatedTroops: "10",
            toUpdatedTroops: "5",
            ontoMoreOrEq: "0",
        });
        assert.equal(w[1], BigInt(0));
        await circuit.checkConstraints(w);
    });

    it("passes if an allowable number of troops are moved", async () => {
        const p1 = new Player("A", "");
        const l1 = { r: 0, c: 0 };
        const p2 = new Player("B", "");
        const l2 = { r: 1, c: 0 };

        const w = await circuit.calculateWitness({
            currentWaterInterval: "0",
            ontoSelfOrUnowned: "0",
            fromCityTroops: "10",
            toCityTroops: "5",
            tFrom: new Tile(
                p1,
                l1,
                10,
                BigInt(0),
                1,
                0,
                Tile.BARE_TILE
            ).toCircuitInput(),
            tTo: new Tile(
                p2,
                l2,
                5,
                BigInt(0),
                2,
                0,
                Tile.BARE_TILE
            ).toCircuitInput(),
            uFrom: new Tile(
                p1,
                l1,
                9,
                BigInt(0),
                1,
                0,
                Tile.BARE_TILE
            ).toCircuitInput(),
            uTo: new Tile(
                p2,
                l2,
                4,
                BigInt(0),
                2,
                0,
                Tile.BARE_TILE
            ).toCircuitInput(),
            fromUpdatedTroops: "10",
            toUpdatedTroops: "5",
            ontoMoreOrEq: "1",
        });
        assert.equal(w[1], BigInt(1));
        await circuit.checkConstraints(w);
    });
});

describe("Unit tests for CheckTroopUpdates()", () => {
    let circuit;

    beforeEach(async () => {
        circuit = await wasm("test/circuits/test_check_trp_updates.circom");
    });

    it("fails if bare tile loses troops over time", async () => {
        const tTile = new Tile(
            new Player("A", ""),
            { r: 0, c: 0 },
            10,
            BigInt(0),
            1,
            5,
            Tile.BARE_TILE
        );
        const uTile = new Tile(
            new Player("A", ""),
            { r: 0, c: 0 },
            5,
            BigInt(0),
            1,
            10,
            Tile.BARE_TILE
        );

        const w = await circuit.calculateWitness({
            currentWaterInterval: 10,
            cityTroops: 10,
            tTile: tTile.toCircuitInput(),
            uTile: uTile.toCircuitInput(),
            updatedTroops: 5,
        });
        assert.equal(w[1], BigInt(0));
        await circuit.checkConstraints(w);
    });

    it("fails if bare tile gains troops over time", async () => {
        const tTile = new Tile(
            new Player("A", ""),
            { r: 0, c: 0 },
            10,
            BigInt(0),
            1,
            5,
            Tile.BARE_TILE
        );
        const uTile = new Tile(
            new Player("A", ""),
            { r: 0, c: 0 },
            15,
            BigInt(0),
            1,
            10,
            Tile.BARE_TILE
        );

        const w = await circuit.calculateWitness({
            currentWaterInterval: 10,
            cityTroops: 10,
            tTile: tTile.toCircuitInput(),
            uTile: uTile.toCircuitInput(),
            updatedTroops: 15,
        });
        assert.equal(w[1], BigInt(0));
        await circuit.checkConstraints(w);
    });

    it("fails if water tile loses incorrect number of troops", async () => {
        const tTile = new Tile(
            new Player("A", ""),
            { r: 0, c: 0 },
            10,
            BigInt(0),
            1,
            5,
            Tile.WATER_TILE
        );
        const uTile = new Tile(
            new Player("A", ""),
            { r: 0, c: 0 },
            6,
            BigInt(0),
            1,
            10,
            Tile.WATER_TILE
        );

        const w = await circuit.calculateWitness({
            currentWaterInterval: 10,
            cityTroops: 10,
            tTile: tTile.toCircuitInput(),
            uTile: uTile.toCircuitInput(),
            updatedTroops: 6,
        });
        assert.equal(w[1], BigInt(0));
        await circuit.checkConstraints(w);
    });

    it("passes if bare tile loses no troops over time", async () => {
        const tTile = new Tile(
            new Player("A", ""),
            { r: 0, c: 0 },
            10,
            BigInt(0),
            1,
            5,
            Tile.BARE_TILE
        );
        const uTile = new Tile(
            new Player("A", ""),
            { r: 0, c: 0 },
            10,
            BigInt(0),
            1,
            10,
            Tile.BARE_TILE
        );

        const w = await circuit.calculateWitness({
            currentWaterInterval: 10,
            cityTroops: 10,
            tTile: tTile.toCircuitInput(),
            uTile: uTile.toCircuitInput(),
            updatedTroops: 10,
        });
        assert.equal(w[1], BigInt(1));
        await circuit.checkConstraints(w);
    });

    it("passes if water tile loses appropriate number of troops", async () => {
        const tTile = new Tile(
            new Player("A", ""),
            { r: 0, c: 0 },
            10,
            BigInt(0),
            1,
            5,
            Tile.WATER_TILE
        );
        const uTile = new Tile(
            new Player("A", ""),
            { r: 0, c: 0 },
            5,
            BigInt(0),
            1,
            10,
            Tile.WATER_TILE
        );

        const w = await circuit.calculateWitness({
            currentWaterInterval: 10,
            cityTroops: 10,
            tTile: tTile.toCircuitInput(),
            uTile: uTile.toCircuitInput(),
            updatedTroops: 5,
        });
        assert.equal(w[1], BigInt(1));
        await circuit.checkConstraints(w);
    });
});

describe("Unit tests for CheckRsrcCases()", () => {
    let circuit;

    beforeEach(async () => {
        circuit = await wasm("test/circuits/test_check_rsrc_cases.circom");
    });

    it("fails if rsrc management doesn't hold (onto enemy + less rsrcs)", async () => {
        const uFrom = Tile.genOwned(
            new Player("A", ""),
            { r: 0, c: 0 },
            10,
            1,
            0,
            Tile.BARE_TILE
        );
        const uTo = Tile.genOwned(
            new Player("A", ""),
            { r: 1, c: 0 },
            20,
            2,
            0,
            Tile.BARE_TILE
        );

        const w = await circuit.calculateWitness({
            fromUpdatedTroops: "10",
            toUpdatedTroops: "5",
            uFrom: uFrom.toCircuitInput(),
            uTo: uTo.toCircuitInput(),
            ontoSelfOrUnowned: "0",
            ontoMoreOrEq: "0",
        });
        assert.equal(w[1], BigInt(0));
        await circuit.checkConstraints(w);
    });

    it("fails if rsrc management doesn't hold (onto enemy + more/eq. rsrcs)", async () => {
        const uFrom = Tile.genOwned(
            new Player("A", ""),
            { r: 0, c: 0 },
            5,
            1,
            0,
            Tile.BARE_TILE
        );
        const uTo = Tile.genOwned(
            new Player("A", ""),
            { r: 1, c: 0 },
            10,
            2,
            0,
            Tile.BARE_TILE
        );

        const w = await circuit.calculateWitness({
            fromUpdatedTroops: "10",
            toUpdatedTroops: "20",
            uFrom: uFrom.toCircuitInput(),
            uTo: uTo.toCircuitInput(),
            ontoSelfOrUnowned: "0",
            ontoMoreOrEq: "1",
        });
        assert.equal(w[1], BigInt(0));
        await circuit.checkConstraints(w);
    });

    it("fails if rsrc management doesn't hold (onto self or unowned)", async () => {
        const uFrom = Tile.genOwned(
            new Player("A", ""),
            { r: 0, c: 0 },
            5,
            1,
            0,
            Tile.BARE_TILE
        );
        const uTo = Tile.genOwned(
            new Player("A", ""),
            { r: 1, c: 0 },
            15,
            2,
            0,
            Tile.BARE_TILE
        );

        const w = await circuit.calculateWitness({
            fromUpdatedTroops: "10",
            toUpdatedTroops: "5",
            uFrom: uFrom.toCircuitInput(),
            uTo: uTo.toCircuitInput(),
            ontoSelfOrUnowned: "1",
            ontoMoreOrEq: "1",
        });
        assert.equal(w[1], BigInt(0));
        await circuit.checkConstraints(w);
    });

    it("passes if rsrc management holds (onto enemy + less rsrcs)", async () => {
        const uFrom = Tile.genOwned(
            new Player("A", ""),
            { r: 0, c: 0 },
            3,
            1,
            0,
            Tile.BARE_TILE
        );
        const uTo = Tile.genOwned(
            new Player("A", ""),
            { r: 1, c: 0 },
            2,
            1,
            0,
            Tile.BARE_TILE
        );

        const w = await circuit.calculateWitness({
            fromUpdatedTroops: "10",
            toUpdatedTroops: "5",
            uFrom: uFrom.toCircuitInput(),
            uTo: uTo.toCircuitInput(),
            ontoSelfOrUnowned: "0",
            ontoMoreOrEq: "0",
        });
        assert.equal(w[1], BigInt(1));
        await circuit.checkConstraints(w);
    });

    it("passes if rsrc management holds (onto enemy + more/eq. rsrcs)", async () => {
        const uFrom = Tile.genOwned(
            new Player("A", ""),
            { r: 0, c: 0 },
            5,
            1,
            0,
            Tile.BARE_TILE
        );
        const uTo = Tile.genOwned(
            new Player("A", ""),
            { r: 1, c: 0 },
            15,
            2,
            0,
            Tile.BARE_TILE
        );

        const w = await circuit.calculateWitness({
            fromUpdatedTroops: "10",
            toUpdatedTroops: "20",
            uFrom: uFrom.toCircuitInput(),
            uTo: uTo.toCircuitInput(),
            ontoSelfOrUnowned: "0",
            ontoMoreOrEq: "1",
        });
        assert.equal(w[1], BigInt(1));
        await circuit.checkConstraints(w);
    });

    it("passes if rsrc management holds (onto self or unowned)", async () => {
        const uFrom = Tile.genOwned(
            new Player("A", ""),
            { r: 0, c: 0 },
            5,
            1,
            0,
            Tile.BARE_TILE
        );
        const uTo = Tile.genOwned(
            new Player("A", ""),
            { r: 1, c: 0 },
            5,
            2,
            0,
            Tile.BARE_TILE
        );

        const w = await circuit.calculateWitness({
            fromUpdatedTroops: "10",
            toUpdatedTroops: "0",
            uFrom: uFrom.toCircuitInput(),
            uTo: uTo.toCircuitInput(),
            ontoSelfOrUnowned: "1",
            ontoMoreOrEq: "0",
        });
        assert.equal(w[1], BigInt(1));
        await circuit.checkConstraints(w);
    });
});

describe("Unit tests for CheckCityIdCases()", () => {
    let circuit;

    beforeEach(async () => {
        circuit = await wasm("test/circuits/test_check_city_ids.circom");
    });

    it("fails if from tile changes city ID", async () => {
        const p1 = new Player("A", "");
        const l1 = { r: 0, c: 0 };
        const p2 = new Player("B", "");
        const l2 = { r: 1, c: 0 };

        const tFrom = Tile.genOwned(p1, l1, 10, 1, 0, Tile.BARE_TILE);
        const tTo = Tile.genOwned(p2, l2, 5, 2, 0, Tile.BARE_TILE);
        const uFrom = Tile.genOwned(p1, l1, 9, 3, 0, Tile.BARE_TILE);
        const uTo = Tile.genOwned(p2, l2, 4, 2, 0, Tile.BARE_TILE);

        const w = await circuit.calculateWitness({
            tFrom: tFrom.toCircuitInput(),
            tTo: tTo.toCircuitInput(),
            uFrom: uFrom.toCircuitInput(),
            uTo: uTo.toCircuitInput(),
            ontoSelf: "0",
            ontoEnemy: "1",
            ontoMoreOrEq: "0",
        });
        assert.equal(w[1], BigInt(0));
    });

    it("fails if city ID changes when to tile is a city center", async () => {
        const p1 = new Player("A", "");
        const l1 = { r: 0, c: 0 };
        const p2 = new Player("B", "");
        const l2 = { r: 1, c: 0 };

        const tFrom = Tile.genOwned(p1, l1, 10, 1, 0, Tile.BARE_TILE);
        const tTo = Tile.genOwned(p2, l2, 5, 2, 0, Tile.CITY_TILE);
        const uFrom = Tile.genOwned(p1, l1, 9, 1, 0, Tile.BARE_TILE);
        const uTo = Tile.genOwned(p2, l2, 4, 3, 0, Tile.CITY_TILE);

        const w = await circuit.calculateWitness({
            tFrom: tFrom.toCircuitInput(),
            tTo: tTo.toCircuitInput(),
            uFrom: uFrom.toCircuitInput(),
            uTo: uTo.toCircuitInput(),
            ontoSelf: "0",
            ontoEnemy: "1",
            ontoMoreOrEq: "0",
        });
        assert.equal(w[1], BigInt(0));
    });

    it("fails if city ID changes when moving into a different, self-owned city", async () => {
        const p1 = new Player("A", "");
        const l1 = { r: 0, c: 0 };
        const p2 = new Player("B", "");
        const l2 = { r: 1, c: 0 };

        const tFrom = Tile.genOwned(p1, l1, 10, 1, 0, Tile.BARE_TILE);
        const tTo = Tile.genOwned(p1, l2, 5, 2, 0, Tile.BARE_TILE);
        const uFrom = Tile.genOwned(p1, l1, 9, 1, 0, Tile.BARE_TILE);
        const uTo = Tile.genOwned(p1, l2, 6, 1, 0, Tile.BARE_TILE);

        const w = await circuit.calculateWitness({
            tFrom: tFrom.toCircuitInput(),
            tTo: tTo.toCircuitInput(),
            uFrom: uFrom.toCircuitInput(),
            uTo: uTo.toCircuitInput(),
            ontoSelf: "1",
            ontoEnemy: "0",
            ontoMoreOrEq: "0",
        });
        assert.equal(w[1], BigInt(0));
    });

    it("fails if city ID changes when moving onto an enemy with more/eq. rsrcs", async () => {
        const p1 = new Player("A", "");
        const l1 = { r: 0, c: 0 };
        const p2 = new Player("B", "");
        const l2 = { r: 1, c: 0 };

        const tFrom = Tile.genOwned(p1, l1, 10, 1, 0, Tile.BARE_TILE);
        const tTo = Tile.genOwned(p2, l2, 15, 2, 0, Tile.BARE_TILE);
        const uFrom = Tile.genOwned(p1, l1, 9, 1, 0, Tile.BARE_TILE);
        const uTo = Tile.genOwned(p2, l2, 14, 1, 0, Tile.BARE_TILE);

        const w = await circuit.calculateWitness({
            tFrom: tFrom.toCircuitInput(),
            tTo: tTo.toCircuitInput(),
            uFrom: uFrom.toCircuitInput(),
            uTo: uTo.toCircuitInput(),
            ontoSelf: "0",
            ontoEnemy: "1",
            ontoMoreOrEq: "1",
        });
        assert.equal(w[1], BigInt(0));
    });

    it("passes if from tile keeps city ID", async () => {
        const p1 = new Player("A", "");
        const l1 = { r: 0, c: 0 };
        const p2 = new Player("B", "");
        const l2 = { r: 1, c: 0 };

        const tFrom = Tile.genOwned(p1, l1, 10, 1, 0, Tile.BARE_TILE);
        const tTo = Tile.genOwned(p2, l2, 5, 2, 0, Tile.BARE_TILE);
        const uFrom = Tile.genOwned(p1, l1, 9, 1, 0, Tile.BARE_TILE);
        const uTo = Tile.genOwned(p2, l2, 4, 2, 0, Tile.BARE_TILE);

        const w = await circuit.calculateWitness({
            tFrom: tFrom.toCircuitInput(),
            tTo: tTo.toCircuitInput(),
            uFrom: uFrom.toCircuitInput(),
            uTo: uTo.toCircuitInput(),
            ontoSelf: "0",
            ontoEnemy: "1",
            ontoMoreOrEq: "1",
        });
        assert.equal(w[1], BigInt(1));
    });

    it("passes if city ID remains the same when to tile is a city center", async () => {
        const p1 = new Player("A", "");
        const l1 = { r: 0, c: 0 };
        const p2 = new Player("B", "");
        const l2 = { r: 1, c: 0 };

        const tFrom = Tile.genOwned(p1, l1, 10, 1, 0, Tile.BARE_TILE);
        const tTo = Tile.genOwned(p2, l2, 5, 2, 0, Tile.CITY_TILE);
        const uFrom = Tile.genOwned(p1, l1, 4, 1, 0, Tile.BARE_TILE);
        const uTo = Tile.genOwned(p1, l2, 1, 2, 0, Tile.CITY_TILE);

        const w = await circuit.calculateWitness({
            tFrom: tFrom.toCircuitInput(),
            tTo: tTo.toCircuitInput(),
            uFrom: uFrom.toCircuitInput(),
            uTo: uTo.toCircuitInput(),
            ontoSelf: "0",
            ontoEnemy: "1",
            ontoMoreOrEq: "0",
        });
        assert.equal(w[1], BigInt(1));
    });

    it("passes if city ID remains the same when moving into a self-owned city", async () => {
        const p1 = new Player("A", "");
        const l1 = { r: 0, c: 0 };
        const p2 = new Player("B", "");
        const l2 = { r: 1, c: 0 };

        const tFrom = Tile.genOwned(p1, l1, 10, 1, 0, Tile.BARE_TILE);
        const tTo = Tile.genOwned(p1, l2, 5, 2, 0, Tile.BARE_TILE);
        const uFrom = Tile.genOwned(p1, l1, 9, 1, 0, Tile.BARE_TILE);
        const uTo = Tile.genOwned(p1, l2, 6, 2, 0, Tile.BARE_TILE);

        const w = await circuit.calculateWitness({
            tFrom: tFrom.toCircuitInput(),
            tTo: tTo.toCircuitInput(),
            uFrom: uFrom.toCircuitInput(),
            uTo: uTo.toCircuitInput(),
            ontoSelf: "1",
            ontoEnemy: "0",
            ontoMoreOrEq: "0",
        });
        assert.equal(w[1], BigInt(1));
    });

    it("passes if city ID remains the same when moving onto an enemy with more/eq. rsrcs", async () => {
        const p1 = new Player("A", "");
        const l1 = { r: 0, c: 0 };
        const p2 = new Player("B", "");
        const l2 = { r: 1, c: 0 };

        const tFrom = Tile.genOwned(p1, l1, 10, 1, 0, Tile.BARE_TILE);
        const tTo = Tile.genOwned(p2, l2, 15, 2, 0, Tile.BARE_TILE);
        const uFrom = Tile.genOwned(p1, l1, 9, 1, 0, Tile.BARE_TILE);
        const uTo = Tile.genOwned(p2, l2, 14, 2, 0, Tile.BARE_TILE);

        const w = await circuit.calculateWitness({
            tFrom: tFrom.toCircuitInput(),
            tTo: tTo.toCircuitInput(),
            uFrom: uFrom.toCircuitInput(),
            uTo: uTo.toCircuitInput(),
            ontoSelf: "0",
            ontoEnemy: "1",
            ontoMoreOrEq: "1",
        });
        assert.equal(w[1], BigInt(1));
    });

    it("passes if city ID changes when taking enemy tile", async () => {
        const p1 = new Player("A", "");
        const l1 = { r: 0, c: 0 };
        const p2 = new Player("B", "");
        const l2 = { r: 1, c: 0 };

        const tFrom = Tile.genOwned(p1, l1, 10, 1, 0, Tile.BARE_TILE);
        const tTo = Tile.genOwned(p2, l2, 5, 2, 0, Tile.BARE_TILE);
        const uFrom = Tile.genOwned(p1, l1, 3, 1, 0, Tile.BARE_TILE);
        const uTo = Tile.genOwned(p2, l2, 2, 1, 0, Tile.BARE_TILE);

        const w = await circuit.calculateWitness({
            tFrom: tFrom.toCircuitInput(),
            tTo: tTo.toCircuitInput(),
            uFrom: uFrom.toCircuitInput(),
            uTo: uTo.toCircuitInput(),
            ontoSelf: "0",
            ontoEnemy: "1",
            ontoMoreOrEq: "0",
        });
        assert.equal(w[1], BigInt(1));
    });

    it("passes if city ID changes when taking unowned tile", async () => {
        const p1 = new Player("A", "");
        const l1 = { r: 0, c: 0 };
        const p2 = new Player("B", "");
        const l2 = { r: 1, c: 0 };

        const tFrom = Tile.genOwned(p1, l1, 10, 1, 0, Tile.BARE_TILE);
        const tTo = Tile.genVirtual(l2, BigInt(0), terrainUtils);
        const uFrom = Tile.genOwned(p1, l1, 5, 1, 0, Tile.BARE_TILE);
        const uTo = Tile.genOwned(p1, l2, 5, 1, 0, Tile.BARE_TILE);

        const w = await circuit.calculateWitness({
            tFrom: tFrom.toCircuitInput(),
            tTo: tTo.toCircuitInput(),
            uFrom: uFrom.toCircuitInput(),
            uTo: uTo.toCircuitInput(),
            ontoSelf: "0",
            ontoEnemy: "0",
            ontoMoreOrEq: "0",
        });
        assert.equal(w[1], BigInt(1));
    });
});
