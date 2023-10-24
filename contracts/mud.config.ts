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
                numStartingTroops: "uint32",
                claimedMoveLifeSpan: "uint256",
            },
        },
        // Stores the blockNumber that the most recent state by the given pkHash was foundeds
        Founded: {
            keySchema: { pkHash: "uint256" },
            valueSchema: {
                value: "uint256",
            },
        },
        TileCommitment: {
            keySchema: { id: "uint256" },
            valueSchema: {
                value: "bool",
            },
        },
        City: {
            keySchema: { id: "uint24" },
            valueSchema: {
                troopCount: "uint32",
                centerTroopCount: "uint32",
                area: "uint32",
            },
        },
        CityPlayer: {
            keySchema: { id: "uint24" },
            valueSchema: {
                value: "uint256",
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
            args: [resolveTableId("CityPlayer")],
        },
    ],
});
