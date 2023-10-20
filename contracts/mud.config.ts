import { resolveTableId } from "@latticexyz/config";
import { mudConfig } from "@latticexyz/world/register";

export default mudConfig({
    tables: {
        Config: {
            keySchema: {},
            valueSchema: {
                enclave: "address",
                verifierContract: "address",
                numBlocksInInterval: "uint256",
                numStartingResources: "uint256",
                claimedMoveLifeSpan: "uint256",
            },
        },
        TileCommitment: {
            keySchema: { id: "uint256" },
            valueSchema: {
                value: "bool",
            },
        },
        CityTroopCount: {
            keySchema: { id: "uint24" },
            valueSchema: {
                value: "uint32",
            },
        },
        CityCenterTroopCount: {
            keySchema: { id: "uint24" },
            valueSchema: {
                value: "uint32",
            },
        },
        CityArea: {
            keySchema: { id: "uint24" },
            // Tracks total city area for this city (not incl. water tiles)
            valueSchema: {
                value: "uint32",
            },
        },
        CityPlayer: {
            keySchema: { id: "uint24" },
            valueSchema: {
                value: "uint256",
            },
        },
        PlayerCities: {
            keySchema: { pkHash: "uint256" },
            valueSchema: {
                value: "uint24[]",
            },
        },
        PlayerLastUpdateBlock: {
            keySchema: { pkHash: "uint256" },
            valueSchema: {
                value: "uint256",
            },
        },
    },
    modules: [
        {
            name: "KeysWithValueModule",
            root: true,
            args: [resolveTableId("CityState")],
        },
        {
            name: "KeysWithValueModule",
            root: true,
            args: [resolveTableId("CityCenter")],
        },
        {
            name: "KeysWithValueModule",
            root: true,
            args: [resolveTableId("StatePlayer")],
        },
    ],
    enums: {
        Direction: ["UP", "DOWN", "LEFT", "RIGHT"],
        Terrain: ["BARE", "MOUNTAIN", "WATER"],
        Bonus: ["NONE", "TROOP"],
    },
});
