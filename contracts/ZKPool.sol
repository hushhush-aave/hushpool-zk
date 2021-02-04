//SPDX-License-Identifier: Unlicense
pragma solidity 0.6.12;

import "hardhat/console.sol";

// Snark Proofs

import {IncrementalMerkleTree} from "./semaphore/IncrementalMerkleTree.sol";
import {SnarkConstants} from "./semaphore/SnarkConstants.sol";
import {MiMC} from "./semaphore/MiMC.sol";
import {Verifier} from "./withdrawVerifier.sol";

abstract contract ZKPool is IncrementalMerkleTree, Verifier {
    mapping(uint256 => bool) public nullifiers;
    uint256 public immutable depositSize;

    uint256 public constant NOTHING_UP_MY_SLEEVE_ZERO =
        uint256(keccak256(abi.encodePacked("HushHush"))) % SNARK_SCALAR_FIELD;

    event NullifierAdd(uint256 indexed nullifier);

    constructor(
        uint8 _treeLevels,
        uint256 _depositSize
    ) public IncrementalMerkleTree(_treeLevels, NOTHING_UP_MY_SLEEVE_ZERO) {
        depositSize = _depositSize;
    }

   
    function deposit(uint256 _innerCommit) public {
        uint256 leaf = hashLeftRight(depositSize, _innerCommit);
        insertLeaf(leaf);
        _processDeposit();
    }

    function _processDeposit() internal virtual;

    function withdraw(
        address _to,
        uint256[8] memory _proof,
        uint256 _withdrawAmount,
        uint256 _root,
        uint256 _nullifier,
        uint256 _newLeaf
    )
        public
        isValidProof(_proof, _withdrawAmount, _root, _nullifier, _newLeaf)
    {
        nullifiers[_nullifier] = true;
        emit NullifierAdd(_nullifier);

        insertLeaf(_newLeaf);
        _processWithdraw(_to, _withdrawAmount);
    }

    function _processWithdraw(address _to, uint256 _withdrawAmount) internal virtual;

    /**
     * Checks if all values within pi_a, pi_b, and pi_c of a zk-SNARK are less than the scalar field.
     * @param _proof The elements of the proof
     **/
    function areAllValidFieldElements(uint256[8] memory _proof)
        internal
        pure
        returns (bool)
    {
        return
            _proof[0] < SNARK_SCALAR_FIELD &&
            _proof[1] < SNARK_SCALAR_FIELD &&
            _proof[2] < SNARK_SCALAR_FIELD &&
            _proof[3] < SNARK_SCALAR_FIELD &&
            _proof[4] < SNARK_SCALAR_FIELD &&
            _proof[5] < SNARK_SCALAR_FIELD &&
            _proof[6] < SNARK_SCALAR_FIELD &&
            _proof[7] < SNARK_SCALAR_FIELD;
    }

    /**
     * @notice A modifier which ensures that the proof is valid
     * @param _proof The proof elements
     * @param _withdrawAmount The amount to withdraw from the prool
     * @param _root The root used in the proof
     * @param _nullifier The nullifier for the spent leaf
     * @param _newLeaf The fresh leaf, e.g., concealed output
     */
    modifier isValidProof(
        uint256[8] memory _proof,
        uint256 _withdrawAmount,
        uint256 _root,
        uint256 _nullifier,
        uint256 _newLeaf
    ) {
        require(
            areAllValidFieldElements(_proof),
            "Invalid field element(s) in the proof"
        );

        require(
            _nullifier < SNARK_SCALAR_FIELD,
            "The nullifier hash is larger than the field"
        );

        require(nullifiers[_nullifier] == false, "Reuse of nullifier");

        require(rootHistory[_root], "Root not seen");

        // We need not validate that _newLeaf < SNARK_SCALAR_FIELD as it is already done inside insertleaf.
        // But we do it early to not spend unnecessary gas here.
        require(
            _newLeaf < SNARK_SCALAR_FIELD,
            "The leaf is larger than the field"
        );

        uint256[4] memory publicSignals = [_nullifier, _newLeaf, _withdrawAmount, _root];

        (uint256[2] memory a, uint256[2][2] memory b, uint256[2] memory c) = unpackProof(_proof);

        require(
            verifyProof(a, b, c, publicSignals),
            "The proof is invalid"
        );
        console.log("IS verified");

        _;
    }

    /**
     * A convenience function which returns a uint256 array of 8 elements which
     * comprise a Groth16 zk-SNARK proof's pi_a, pi_b, and pi_c  values.
     * @param _a The corresponding `a` parameter to verifier.sol's verifyProof()
     * @param _b The corresponding `b` parameter to verifier.sol's verifyProof()
     * @param _c The corresponding `c` parameter to verifier.sol's verifyProof()
     **/
    function packProof(
        uint256[2] memory _a,
        uint256[2][2] memory _b,
        uint256[2] memory _c
    ) public pure returns (uint256[8] memory) {
        return [
            _a[0],
            _a[1],
            _b[0][0],
            _b[0][1],
            _b[1][0],
            _b[1][1],
            _c[0],
            _c[1]
        ];
    }

    /**
     * A convenience function which converts an array of 8 elements, generated
     * by packProof(), into a format which verifier.sol's verifyProof()
     * accepts.
     * @param _proof The proof elements.
     **/
    function unpackProof(uint256[8] memory _proof)
        public
        pure
        returns (
            uint256[2] memory,
            uint256[2][2] memory,
            uint256[2] memory
        )
    {
        return (
            [_proof[0], _proof[1]],
            [[_proof[2], _proof[3]], [_proof[4], _proof[5]]],
            [_proof[6], _proof[7]]
        );
    }

}
