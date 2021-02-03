include "../../node_modules/circomlib/circuits/comparators.circom";
include "../../node_modules/circomlib/circuits/bitify.circom";
include "merkleTree.circom";

template IndexToPath(n) {
    signal input index;
    signal output indicies[n];

    component indiciesBits = Num2Bits(n);
    index ==> indiciesBits.in;

    for (var i = 0; i < n; i++){
        indicies[i] <== indiciesBits.out[i];
    }
}

template NullifierHasher() {
	signal input secret;
	signal input leafIndex;

	signal output nullifier;

	component hasher = HashLeftRight();

	secret ==> hasher.left;
	leafIndex ==> hasher.right;
	nullifier <== hasher.hash;
}

template CommitmentHasher(){
	signal input secret;
	signal input nonce;
	signal input balance;

	signal innerCommit;

	signal output commitment;

	component hashers[2];
	hashers[0] = HashLeftRight();
	hashers[1] = HashLeftRight();

	secret ==> hashers[0].left;
	nonce ==> hashers[0].right;
	innerCommit <== hashers[0].hash;

	balance ==> hashers[1].left;
	innerCommit ==> hashers[1].right;
	commitment <== hashers[1].hash;
}

// Non-optimised, some signals can probably be removed to minimize circuit size. But this is more readable.
template Withdraw(levels) {
	signal input withdrawAmount;
	signal input root;

	// The old commitment
	signal private input oldSecret;
	signal private input oldNonce;
	signal private input oldBalance;
	signal private input index; // index of old commitment leaf.

	// The merkle paths
	signal private input pathElements[levels];
	// signal private input pathIndices[levels]; // We compute this from the index

	// Inputs for the new 
	signal private input secret;
	signal private input nonce;

	// Outputs
	signal output nullifier;
	signal output commitment;

	// Intermediates
	signal balance;
	signal oldLeaf;

	// Ensure that oldBalance >= withdraw amount. Then set balance.
	component greaterThan = GreaterEqThan(128);
	oldBalance ==> greaterThan.in[0];
	withdrawAmount ==> greaterThan.in[1];
	greaterThan.out === 1;
	balance <== oldBalance - withdrawAmount;

	// Recreate commitment, e.g., if we can do this, we know.
	component oldCommitment = CommitmentHasher();
	oldSecret ==> oldCommitment.secret;
	oldNonce ==> oldCommitment.nonce;
	oldBalance ==> oldCommitment.balance;
	oldLeaf <== oldCommitment.commitment;

	// Merkle proof. Use index to find indeciesPath
	component indexToPath = IndexToPath(levels);
	index ==> indexToPath.index;
	
	component tree = MerkleTreeChecker(levels);
	oldLeaf ==> tree.leaf;
	root ==> tree.root;

	for (var i = 0; i < levels; i++){
		tree.pathElements[i] <== pathElements[i];
		tree.pathIndices[i] <== indexToPath.indicies[i]; // Using the indecies to path here
	}

	// Compute nullifier
	component nullifierHasher = NullifierHasher();
	oldSecret ==> nullifierHasher.secret;
	index ==> nullifierHasher.leafIndex;
	nullifier <== nullifierHasher.nullifier;

	// Compute new commitment
	component newCommitment = CommitmentHasher();
	secret ==> newCommitment.secret;
	nonce ==> newCommitment.nonce;
	balance ==> newCommitment.balance;
	commitment <== newCommitment.commitment;
}

component main = Withdraw(3);