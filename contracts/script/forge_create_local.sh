# Set TREE_DEPTH and NOTHING_UP_MY_SLEEVE vars
source ../../.env

# Address of SNARK verifier
VERIFIER=0x5FbDB2315678afecb367f032d93F642f64180aa3

forge create src/NStates.sol:NStates \
    --rpc-url http://127.0.0.1:8545 \
    --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
    --constructor-args $TREE_DEPTH $NOTHING_UP_MY_SLEEVE $VERIFIER
