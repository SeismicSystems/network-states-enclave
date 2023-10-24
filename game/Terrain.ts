import { createPerlin } from "@latticexyz/noise";
import { Terrain } from "./Utils.js";
import { Location } from "./Tile.js";

export class TerrainUtils {
    perlin: any;
    terrainMemo: Map<string, Terrain>;
    perlinDenom = Number(process.env.PERLIN_DENOM);
    perlinDigits = Number(process.env.PERLIN_DIGITS);
    perlinThresholdHill = Number(process.env.PERLIN_THRESHOLD_HILL);
    perlinThresholdWater = Number(process.env.PERLIN_THRESHOLD_WATER);

    constructor() {
        this.terrainMemo = new Map<string, Terrain>();
    }

    async setup() {
        this.perlin = await createPerlin();
    }

    static getKey(loc: Location) {
        return `${loc.r},${loc.c}`;
    }

    public getTerrainAtLoc = (loc: Location) => {
        const key = TerrainUtils.getKey(loc);
        const cached = this.terrainMemo.get(key);
        if (cached !== undefined) {
            return cached;
        }
        const perlinValue = Math.floor(
            this.perlin(loc.r, loc.c, 0, this.perlinDenom) *
                10 ** this.perlinDigits
        );

        let terrain: Terrain;
        if (perlinValue >= this.perlinThresholdHill) {
            terrain = Terrain.HILL;
        } else if (perlinValue <= this.perlinThresholdWater) {
            terrain = Terrain.WATER;
        } else {
            terrain = Terrain.BARE;
        }
        this.terrainMemo.set(key, terrain);
        return terrain;
    };
}
