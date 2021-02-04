# Overview
This section (hush-withdraw) contains the zero-knowledge circuits and keys for the hush hush protocol. 

To test the circuits, we have a small set of `js` files that takes care of this.

# Test-suite
Very simple. This is really just to see that the stuff works. The `test.js` script will run a very small test that will create a merkle-tree of depth 3, that have 5 leafs defined by users. Of these 5 commitments, index 0 and index 4 are identical. This is to ensure that you are not able to fuck over somebody by picking the same "nullifier"-value.
It will print a result that looks like this for each of the proofs. A status of the verification, how many coins are in the spent utxo, how much is withdrawn and how much is in the new commitment leaf.: 
```bash
Accept proof. Spend ( 6916379990818759645 ), withdraw  1284813134 create ( 6916379989533946511 ): 4521118041159501863462521679569866335743860363032419381818207185901659021412
```
for each 

```bash
node ./test.js
```

https://github.com/iden3/snarkjs


# Prepare powers of tau before circuits
```bash
# Start a new powers of tau ceremony and make a contribution. 
# The result is stored in pot14 and supports circuits of size 2^14.
snarkjs powersoftau new bn128 14 pot14/pot14_0000.ptau -v
snarkjs powersoftau contribute pot14/pot14_0000.ptau pot14/pot14_0001.ptau --name="First contribution" -v

# Prepare phase 2
snarkjs powersoftau prepare phase2 pot14_0001.ptau pot14_final.ptau -v
```


# Compile circuit and generate prove and verification keys 
```bash
# compile circuit
circom circuits/withdraw.circom --r1cs --wasm --sym

# information and constraints
snarkjs info -c withdraw.r1cs
#snarkjs print -r circuit.r1cs -s circuit.sym

# Start a new zkey and make a contribution
snarkjs zkey new withdraw.r1cs pot14/pot14_final.ptau withdraw_0000.zkey
snarkjs zkey contribute withdraw_0000.zkey withdraw_final.zkey --name="1st Contributor Name" -v 

# Export the verification key
snarkjs zkey export verificationkey withdraw_final.zkey verification_key.json

# Export a solidity verifier
snarkjs zkey export solidityverifier withdraw_final.zkey withdrawVerifier.sol
```



# Generate and test proof from input.json
```bash
snarkjs wtns calculate withdraw.wasm input.json witness.wtns
snarkjs groth16 prove withdraw_final.zkey witness.wtns proof.json public.json
snarkjs groth16 verify verification_key.json public.json proof.json
```



// It seems like the major issue is how to format it.

https://github.com/kendricktan/hello-world-zk-dapp/blob/master/packages/scripts/index.js