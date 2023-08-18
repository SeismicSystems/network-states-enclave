// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {IncrementalMerkleTree} from "./IncrementalMerkleTree.sol";

/// @title Interface for the solidity verifier produced by verif-manager.circom
interface IVerifier {
    function verifyProof(
        uint256[2] memory a,
        uint256[2][2] memory b,
        uint256[2] memory c,
        uint256[11] memory input
    ) external view returns (bool);
}

/// @title Interface for poseidon hasher where t = 3
interface IHasherT3 {
    function poseidon(uint256[2] memory input) external pure returns (uint256);
}

contract NStates is IncrementalMerkleTree {
    IVerifier verifierContract;
    IHasherT3 hasherT3 = IHasherT3(0x5FbDB2315678afecb367f032d93F642f64180aa3);
    address public owner;

    event NewLeaf(uint256 h);
    event NewNullifier(uint256 nf);
    mapping(uint256 => bool) public nullifiers;

    /// @notice Inherits from Maci's Incremental Merkle Tree
    constructor(
        uint8 treeDepth,
        uint256 nothingUpMySleeve,
        address verifier
    ) IncrementalMerkleTree(treeDepth, nothingUpMySleeve) {
        verifierContract = IVerifier(verifier);
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only the owner can call this function");
        _;
    }


    function set(
        uint256 h
    ) public onlyOwner {
        emit NewLeaf(h);
        insertLeaf(h);
    }

    function move(
        uint256 uFrom,
        uint256 uTo,
        uint256 nfFrom,
        uint256 nfTo
    ) public {
        emit NewLeaf(uFrom);
        emit NewLeaf(uTo);
        emit NewNullifier(nfFrom);
        emit NewNullifier(nfTo);

        nullifiers[nfFrom] = true;
        nullifiers[nfTo] = true;

        insertLeaf(uFrom);
        insertLeaf(uTo);
    }

    function getNumMoves() public view returns (uint256) {
        return nextLeafIndex;
    }

    /// @notice Produces poseidon hash of two children hashes
    /// @param l Left child value
    /// @param r Right child value
    /// @dev Should be internal, but set to public so tests can run from
    ///      ethers. Not ideal, but foundry tests are being wonky.
    function _hashLeftRight(
        uint256 l,
        uint256 r
    ) public view override returns (uint256) {
        return hasherT3.poseidon([l, r]);
    }
}
