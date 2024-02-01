// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import {SpawnInputs} from "common/SpawnInputs.sol";
import {Signature} from "common/Signature.sol";
import {Config, CityPlayer, City, PlayerLastUpdateBlock, SpawnCommitment, TileCommitment} from "codegen/index.sol";

library LibSpawn {
    /// @notice Runs various checks for the move
    function checkSpawnInputs(
        SpawnInputs memory spawnInputs,
        Signature memory sig
    ) internal view {
        require(spawnInputs.spawnCityId != 0, "City ID must be non-zero");

        require(
            CityPlayer.getValue(spawnInputs.spawnCityId) == address(0),
            "City is already in game"
        );
        require(
            _getSigner(spawnInputs.hSpawnTile, sig) ==
                Config.getEnclave(),
            "Enclave spawn sig incorrect"
        );
    }

    function spawnPlayer(address player, SpawnInputs memory sp) internal {
        TileCommitment.deleteRecord(sp.hPrevTile);
        TileCommitment.set(sp.hSpawnTile, true);

        CityPlayer.set(sp.spawnCityId, player);

        uint32 numStartingTroops = Config.getNumStartingTroops();
        City.set({
            id: sp.spawnCityId,
            troopCount: numStartingTroops,
            centerTroopCount: numStartingTroops,
            area: 1
        });

        PlayerLastUpdateBlock.set(player, block.number);
    }

    function resetPlayer(address player) internal {
        SpawnCommitment.deleteRecord(player);
    }

    function _getSigner(
        uint256 hSpawnTile,
        Signature memory sig
    ) public pure returns (address) {
        bytes32 hash = keccak256(abi.encode(hSpawnTile));
        bytes32 prefixedHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", hash)
        );
        return ecrecover(prefixedHash, sig.v, sig.r, sig.s);
    }
}
