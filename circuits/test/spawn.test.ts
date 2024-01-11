const { wasm } = require("circom_tester");
import { assert } from "chai";
import { Player, TerrainUtils, Tile } from "../../game";

let terrainUtils = new TerrainUtils(2, 2, 19, 18, 17);

describe("Unit tests for CheckSpawnTile()", () => {
    let circuit;

    beforeEach(async () => {
        circuit = await wasm("test/circuits/test_check_spawn_tile.circom");
    });

    it("fails if starting number of resources is incorrect", async () => {
        const w = await circuit.calculateWitness({
            spawnCityId: "100",
            spawnTile: new Tile(
                new Player("A", ""),
                { r: 0, c: 0 },
                0,
                BigInt(0),
                100,
                0,
                Tile.CITY_TILE
            ).toCircuitInput(),
        });
        assert.equal(w[1], BigInt(0));
        await circuit.checkConstraints(w);
    });

    it("fails if tile's city ID and spawnCityId don't match", async () => {
        const w = await circuit.calculateWitness({
            spawnCityId: "100",
            spawnTile: new Tile(
                new Player("A", ""),
                { r: 0, c: 0 },
                50,
                BigInt(0),
                99,
                0,
                Tile.CITY_TILE
            ).toCircuitInput(),
        });
        assert.equal(w[1], BigInt(0));
        await circuit.checkConstraints(w);
    });

    it("fails if update interval isn't 0", async () => {
        const w = await circuit.calculateWitness({
            spawnCityId: "100",
            spawnTile: new Tile(
                new Player("A", ""),
                { r: 0, c: 0 },
                50,
                BigInt(0),
                100,
                10,
                Tile.CITY_TILE
            ).toCircuitInput(),
        });
        assert.equal(w[1], BigInt(0));
        await circuit.checkConstraints(w);
    });

    it("fails if spawn tile isn't a city", async () => {
        const w = await circuit.calculateWitness({
            spawnCityId: "100",
            spawnTile: new Tile(
                new Player("A", ""),
                { r: 0, c: 0 },
                50,
                BigInt(0),
                100,
                0,
                Tile.BARE_TILE
            ).toCircuitInput(),
        });
        assert.equal(w[1], BigInt(0));
        await circuit.checkConstraints(w);
    });

    it("passes if tile is a spawn tile", async () => {
        const w = await circuit.calculateWitness({
            spawnCityId: "100",
            spawnTile: Tile.spawn(
                new Player("A", ""),
                { r: 0, c: 0 },
                50,
                100
            ).toCircuitInput(),
        });
        assert.equal(w[1], BigInt(1));
        await circuit.checkConstraints(w);
    });
});

describe("Unit tests for CheckTileHashes()", () => {
    let circuit;

    let prevTile = Tile.genVirtual({ r: 0, c: 0 }, BigInt(0), terrainUtils);
    let spawnTile = Tile.spawn(new Player("A", ""), { r: 0, c: 0 }, 50, 1);

    beforeEach(async () => {
        circuit = await wasm("test/circuits/test_check_tile_hashes.circom");
    });

    it("fails if prevTile hash is incorrect", async () => {
        const w = await circuit.calculateWitness({
            hPrevTile: "0",
            hSpawnTile: spawnTile.hash(),
            prevTile: prevTile.toCircuitInput(),
            spawnTile: spawnTile.toCircuitInput(),
        });
        assert.equal(w[1], BigInt(0));
        await circuit.checkConstraints(w);
    });

    it("fails if spawnTile hash is incorrect", async () => {
        const w = await circuit.calculateWitness({
            hPrevTile: prevTile.hash(),
            hSpawnTile: "0",
            prevTile: prevTile.toCircuitInput(),
            spawnTile: spawnTile.toCircuitInput(),
        });
        assert.equal(w[1], BigInt(0));
        await circuit.checkConstraints(w);
    });

    it("fails if both hashes are incorrect", async () => {
        const w = await circuit.calculateWitness({
            hPrevTile: "0",
            hSpawnTile: "0",
            prevTile: prevTile.toCircuitInput(),
            spawnTile: spawnTile.toCircuitInput(),
        });
        assert.equal(w[1], BigInt(0));
        await circuit.checkConstraints(w);
    });

    it("passes if both hashes are correct", async () => {
        const w = await circuit.calculateWitness({
            hPrevTile: prevTile.hash(),
            hSpawnTile: spawnTile.hash(),
            prevTile: prevTile.toCircuitInput(),
            spawnTile: spawnTile.toCircuitInput(),
        });
        assert.equal(w[1], BigInt(1));
        await circuit.checkConstraints(w);
    });
});

describe("Unit tests for CheckTileHashes()", () => {
    let circuit;

    beforeEach(async () => {
        circuit = await wasm("test/circuits/test_check_can_spawn.circom");
    });

    it("fails if canSpawn = 1 but tile is Owned", async () => {
        const w = await circuit.calculateWitness({
            canSpawn: "1",
            prevTile: Tile.genOwned(
                new Player("A", ""),
                { r: 0, c: 0 },
                50,
                2,
                0,
                Tile.BARE_TILE
            ).toCircuitInput(),
        });
        assert.equal(w[1], BigInt(0));
        await circuit.checkConstraints(w);
    });

    it("fails if canSpawn = 1 but tile is not bare", async () => {
        const w = await circuit.calculateWitness({
            canSpawn: "1",
            prevTile: Tile.hill({ r: 0, c: 0 }, BigInt(0)).toCircuitInput(),
        });
        assert.equal(w[1], BigInt(0));
        await circuit.checkConstraints(w);
    });

    it("fails if canSpawn = 0 but tile is spawnable", async () => {
        const prevTile = Tile.genVirtual(
            { r: 0, c: 0 },
            BigInt(0),
            terrainUtils
        );
        prevTile.terrain = Tile.BARE_TILE;

        const w = await circuit.calculateWitness({
            canSpawn: "0",
            prevTile: prevTile.toCircuitInput(),
        });
        assert.equal(w[1], BigInt(0));
        await circuit.checkConstraints(w);
    });
});
