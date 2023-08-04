# network-states-experiment

### Set up local network
``` 
anvil
```

### Deploy contracts
``` 
cd contracts/src deploy_poseidon.ts
ts-node deploy_poseidon.ts
# copy over hasher address to contracts/src/NStates.sol
cd contracts/script
bash forge_create_local.sh
# copy over deploy address to {client/client.ts, client/analytics.ts, enclave/server.ts}
```

### Run server
```
cd enclave/
yarn dev
```

### Run client
``` 
cd client/
yarn devA  # can also do {devB, devC}
```
