import { resolveTableId } from "@latticexyz/config";
import { mudConfig } from "@latticexyz/world/register";

export default mudConfig({
    tables: {
        Config: {
            keySchema: {},
            valueSchema: {
                enclave: "address",
                spawnVerifierContract: "address",
                moveVerifierContract: "address",
                snarkFieldSize: "uint256",
                numBlocksInInterval: "uint256",
                numStartingTroops: "uint32",
                claimedMoveLifeSpan: "uint256",
            },
        },
        SpawnCommitment: {
            keySchema: { id: "address" },
            valueSchema: {
                blockNumber: "uint256",
                blindHash: "uint256"
            }
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
                value: "address",
            },
        },
        PlayerLastUpdateBlock: {
            keySchema: { id: "address" },
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
