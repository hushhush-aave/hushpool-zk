# Hushpool-zk
The Hushpool by hush hush is a pool for Aave aTokens, where a depositor can withdraw anonymously, at any point in time. 


# Outline
We are greatly inspired by Tornadocash, and the work in Semaphore.




# Contracts
[Semaphore Incremental Merkle Tree](https://github.com/appliedzkp/semaphore/blob/master/contracts/sol/IncrementalMerkleTree.sol)





# Note
To make it all compile we needed to update the inline assemply of the verifier as `gas` has been updated to `gas()` for solidity 0.6.12; 
Furhter, it seems like we also need to be generating the contract. Fuck.. We can work around it by being annoying as fuck, just go and look what we have done.


