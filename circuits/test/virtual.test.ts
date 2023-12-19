const { wasm } = require("circom_tester");
import { assert } from "chai";
import { TerrainUtils, Location, Tile } from "../../game";

let terrainUtils = new TerrainUtils(2, 2, 19, 18, 17);

describe("Unit tests for perlin noise and CheckVirtType()", () => {
    let circuit;

    beforeEach(async () => {
        circuit = await wasm("test/circuits/test_check_virt_type.circom");
    });

    for (let i = 0; i < 20; i++) {
        let location: Location = {
            r: Math.floor(Math.random() * 10000),
            c: Math.floor(Math.random() * 10000),
        };

        it(`passes if circuit terrain matches typescript at loc (${location.r}, ${location.c})`, async () => {
            const w = await circuit.calculateWitness({
                virt: Tile.genVirtual(
                    location,
                    BigInt(0),
                    terrainUtils
                ).toCircuitInput(),
            });
            assert.equal(w[1], BigInt(1));
            await circuit.checkConstraints(w);
        });
    }
});
