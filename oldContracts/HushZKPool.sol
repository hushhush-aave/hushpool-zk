//SPDX-License-Identifier: Unlicense
pragma solidity 0.6.12;

import "hardhat/console.sol";

import {ILendingPool} from "./aave/interfaces/ILendingPool.sol";
import {
    ILendingPoolAddressesProvider
} from "./aave/interfaces/ILendingPoolAddressesProvider.sol";
import {
    AaveProtocolDataProvider
} from "./aave/misc/AaveProtocolDataProvider.sol";

//import {IAToken} from "./aave/interfaces/IAToken.sol";
import {IERC20} from "./aave/dependencies/openzeppelin/contracts/IERC20.sol";

import {Errors} from "./aave/protocol/libraries/helpers/Errors.sol";

import {
    SafeMath
} from "./aave/dependencies/openzeppelin/contracts/SafeMath.sol";
import {WadRayMath} from "./aave/protocol/libraries/math/WadRayMath.sol";
import {
    SafeERC20
} from "./aave/dependencies/openzeppelin/contracts/SafeERC20.sol";

// Snark Proofs

import {IncrementalMerkleTree} from "./semaphore/IncrementalMerkleTree.sol";
import {SnarkConstants} from "./semaphore/SnarkConstants.sol";
import {MiMC} from "./semaphore/MiMC.sol";

contract ZKPool is IncrementalMerkleTree {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;
    using WadRayMath for uint256;

    mapping(uint256 => bool) public nullifiers;

    uint256 public constant NOTHING_UP_MY_SLEEVE_ZERO =
        uint256(keccak256(abi.encodePacked("Semaphore"))) % SNARK_SCALAR_FIELD;

    ILendingPool immutable lendingPool;
    address public immutable underlyingAsset;
    address public immutable aToken;

    uint256 public immutable depositSize;

    event NullifierAdd(uint256 indexed nullifier);

    constructor(
        uint8 _treeLevels,
        address _asset,
        address _lendingpool,
        address _aToken,
        uint256 _depositSize
    ) public IncrementalMerkleTree(_treeLevels, NOTHING_UP_MY_SLEEVE_ZERO) {
        underlyingAsset = _asset;
        lendingPool = ILendingPool(_lendingpool);
        aToken = _aToken;
        depositSize = _depositSize;
    }

    /**
     * @notice Deposit into the pool, by performing a `safeTransferFrom` fo `depositSize` and inserting a commitment into the tree.
     * The `_innerCommitment` is a
     * Will require the msg.sender to have approved this contract.
     * Be aware that the aTokens amount transferred is computed from the scaled `_depositAmount` meaning that it grows over time.
     * We need to approve more than our current balance to catch this
     * @param _depositAmount The amount of scaled Atokens to deposit
     */
    function deposit(uint256 _innerCommit) public {
        uint256 aTokenAmount = _toAtokens(depositSize);
        IERC20(aToken).safeTransferFrom(
            msg.sender,
            address(this),
            aTokenAmount
        );

        uint256 leaf = hashLeftRight(depositSize, _innerCommit);
        insertLeaf(leaf);
    }

    /**
     * Checks if all values within pi_a, pi_b, and pi_c of a zk-SNARK are less than the scalar field.
     * @param _a The corresponding `a` parameter to verifier.sol's verifyProof()
     * @param _b The corresponding `b` parameter to verifier.sol's verifyProof()
     * @param _c The corresponding `c` parameter to verifier.sol's verifyProof()
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

        uint256[4] memory publicSignals =
            [_withdrawAmount, _root, _nullifier, _newLeaf];

        (uint256[2] memory a, uint256[2][2] memory b, uint256[2] memory c) =
            unpackProof(_proof);

        require(
            verifyProof(a, b, c, publicSignals),
            "Semaphore: invalid proof"
        );

        _;
    }

    /**
     * @notice Withdraw funds `_withdrawAmount` scaled aTokens and transfer the amount of aTokens to `_to`
     * @param _to The address that should receive the underlying underlyingAsset
     * @param _withdrawAmount The amount of scaled aTokens to withdraw.
     */
    function withdraw(
        address _to,
        uint256[8] memory _proof,
        uint256 _withdrawAmount,
        uint256 _root,
        uint256 _nullifier,
        uint256 _newLeaf
    )
        public
        isValidProof(_proof, _root, _withdrawAmount, _nullifier, _newLeaf)
    {
        nullifiers[_nullifier] = true;
        insertLeaf(_newLeaf);

        uint256 _withdrawScaled = _toAtokens(_withdrawAmount);
        IERC20(aToken).safeTransfer(_to, _withdrawScaled);
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

    // Views

    /**
     * @notice Computes the current aToken balance for `_scaledATokens` scaled aTokens
     * @param _scaledATokens The amount of scaled aTokens
     * @return The current aToken balance
     */
    function _toAtokens(uint256 _scaledATokens)
        internal
        view
        returns (uint256)
    {
        return
            _scaledATokens.rayMul(
                lendingPool.getReserveNormalizedIncome(underlyingAsset)
            );
    }

    /**
     * @notice Computes the number of scaled aTokens that one have with a given aTokens amount.
     * @param _aTokens The aMount of aTokens
     * @return The current number of scaled aTokens
     */
    function _toScaledTokens(uint256 _aTokens) internal view returns (uint256) {
        return
            _aTokens.rayDiv(
                lendingPool.getReserveNormalizedIncome(underlyingAsset)
            );
    }

    /**
     * @notice Will return the internal pool balance of `_user` in scaled aTokens
     * @param _user The user to query
     * @return The amount of scaled aTokens the user have in the pool
     */
    function scaledBalanceOf(address _user) public view returns (uint256) {
        return scaledBalance[_user];
    }

    /**
     * @notice Will return the internal pool balance of `_user` in aTokens, e.g., the amount of aTokens that one can expect to withdrawr
     * @param _user The user to query
     * @return The amount of aTokens the user have in the pool
     */
    function balanceOf(address _user) public view returns (uint256) {
        return _toAtokens(scaledBalance[_user]);
    }
}
