import { perlin } from "@darkforest_eth/hashing";
import { Terrain } from "./Utils.js";
import { Location } from "./Tile.js";

export class TerrainUtils {
    terrainMemo: Map<string, Terrain>;
    perlinKey = Number(process.env.PERLIN_KEY);
    perlinScale = Number(process.env.PERLIN_SCALE);
    perlinThresholdBonusTroops = Number(
        process.env.PERLIN_THRESHOLD_BONUS_TROOPS
    );
    perlinThresholdHill = Number(process.env.PERLIN_THRESHOLD_HILL);
    perlinThresholdWater = Number(process.env.PERLIN_THRESHOLD_WATER);

    constructor() {
        this.terrainMemo = new Map<string, Terrain>();
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
        const perlinValue = perlin(
            { x: Number(loc.r), y: Number(loc.c) },
            {
                key: this.perlinKey,
                scale: this.perlinScale,
                mirrorX: false,
                mirrorY: false,
                floor: true,
            }
        );

        let terrain: Terrain;
        if (perlinValue >= this.perlinThresholdBonusTroops) {
            terrain = Terrain.BONUS_TROOPS;
        } else if (perlinValue >= this.perlinThresholdHill) {
            terrain = Terrain.HILL;
        } else if (perlinValue >= this.perlinThresholdWater) {
            terrain = Terrain.WATER;
        } else {
            terrain = Terrain.BARE;
        }
        this.terrainMemo.set(key, terrain);
        return terrain;
    };
}
