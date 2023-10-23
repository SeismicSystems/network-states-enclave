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
                numBlocksInInterval: "uint256",
                numStartingTroops: "uint32",
                claimedMoveLifeSpan: "uint256",
            },
        },
        SpawnCommitment: {
            keySchema: { id: "address" },
            valueSchema: {
                value: "uint256",
            }
        },
        SpawnChallengeHash: {
            keySchema: { id: "address" },
            valueSchema: {
                value: "uint256",
            }
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
