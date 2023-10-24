// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import {SpawnInputs} from "common/SpawnInputs.sol";
import {Signature} from "common/Signature.sol";
import {Config, CityPlayer, CityArea, CityTroopCount, CityCenterTroopCount, PlayerLastUpdateBlock, SpawnCommitment, SpawnChallengeHash, TileCommitment} from "codegen/index.sol";

library LibSpawn {
    /// @notice Runs various checks for the move
    function checkSpawnInputs(
        address player,
        SpawnInputs memory spawnInputs,
        Signature memory sig
    ) internal view {
        require(SpawnCommitment.getValue(player) != 0, "Commit to spawn first");
        require(spawnInputs.spawnCityId != 0, "City ID must be non-zero");
        require(
            CityPlayer.getValue(spawnInputs.spawnCityId) == address(0),
            "City is already in game"
        );
        require(
            checkBlockHash(player, spawnInputs.commitBlockHash),
            "incorrect commitBlockHash"
        );
        require(
            _getSigner(spawnInputs.hPrevTile, spawnInputs.hSpawnTile, sig) ==
                Config.getEnclave(),
            "Enclave spawn sig incorrect"
        );
    }

    function checkBlockHash(
        address player,
        uint256 blockHash
    ) internal view returns (bool) {
        uint256 blockCommited = SpawnCommitment.get(player);
        uint256 snarkFieldSize = Config.getSnarkFieldSize();
        return uint256(blockhash(blockCommited)) % snarkFieldSize == blockHash;
    }

    function spawnPlayer(address player, SpawnInputs memory sp) internal {
        TileCommitment.deleteRecord(sp.hPrevTile);
        TileCommitment.set(sp.hSpawnTile, true);

        CityPlayer.set(sp.spawnCityId, player);

        CityArea.set(sp.spawnCityId, 1);
        uint32 numStartingTroops = Config.getNumStartingTroops();
        CityTroopCount.set(sp.spawnCityId, numStartingTroops);
        CityCenterTroopCount.set(sp.spawnCityId, numStartingTroops);
        PlayerLastUpdateBlock.set(player, block.number);
    }

    function resetPlayer(address player) internal {
        SpawnCommitment.deleteRecord(player);
        SpawnChallengeHash.deleteRecord(player);
    }

    function _getSigner(
        uint256 hPrevTile,
        uint256 hSpawnTile,
        Signature memory sig
    ) public pure returns (address) {
        bytes32 hash = keccak256(abi.encode(sig.b, hPrevTile, hSpawnTile));
        bytes32 prefixedHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", hash)
        );
        return ecrecover(prefixedHash, sig.v, sig.r, sig.s);
    }
}
