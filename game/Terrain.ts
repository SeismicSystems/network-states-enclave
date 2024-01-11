import { perlin } from "@darkforest_eth/hashing";
import { Terrain, Location } from "./Utils";

class DBInterface {
    // [TODO] fill in here
    constructor() {}

    get = (key: string) => {};

    set = (key: string, cached: Terrain) => {};
}

export class TerrainUtils {
    terrainMemo: Map<string, Terrain> | DBInterface;
    perlinKey: number;
    perlinScale: number;
    perlinThresholdBonusTroops: number;
    perlinThresholdHill: number;
    perlinThresholdWater: number;

    constructor(
        perlinKey: number,
        perlinScale: number,
        perlinThresholdBonusTroops: number,
        perlinThresholdHill: number,
        perlinThresholdWater: number,
        dbConstructorOptions?: string
    ) {
        if (dbConstructorOptions) {
            // [TODO]: constructor inputs
            this.terrainMemo = new DBInterface();
        } else {
            this.terrainMemo = new Map<string, Terrain>();
        }

        this.perlinKey = perlinKey;
        this.perlinScale = perlinScale;
        this.perlinThresholdBonusTroops = perlinThresholdBonusTroops;
        this.perlinThresholdHill = perlinThresholdHill;
        this.perlinThresholdWater = perlinThresholdWater;
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
            { x: loc.r, y: loc.c },
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
