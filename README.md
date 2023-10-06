# network-states-experiment

### Set up local network
``` 
anvil
```

### Compile circuit
```
cd circuits/
yarn dev:move
# This takes a while: it compiles the circuit and runs a smoke test
```

### Deploy contracts
```
cd contracts/scripts
bash forge_create_local_verifier.sh
# copy over deploy address to verifierContract in contract/src/NStates.sol
bash forge_create_local.sh
# copy over deploy address to CONTRACT_ADDR in .env
```

### Run server
```
cd enclave/
yarn dev
# Wait for "Server running..." log
```

### Run client
``` 
cd client/
yarn devA  # can also do {devB, devC}
```
