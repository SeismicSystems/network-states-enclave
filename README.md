# network-states-experiment
This README document typically outlines the necessary steps to get your application up and running.

## What is this repository for?

* To be determined (TBD).

## How do I get set up?

* The setup for this repository on the local system can be done through Docker or manually.

### Using Docker

* Clone the repository.
* Ensure that Docker is installed and running. Refer to [docker setup](https://docs.docker.com/engine/install/) for a fresh installation.
* Make sure you have the `.env` file (you can ask the repository manager to provide it).
* Run the following command to build and start Docker:

    ```bash
    docker-compose up --build
    ```

* After all the containers are running, go inside the client container by running:

    ```bash
    docker-compose exec -it client bash
    ```

* Now that you are inside the client container, start the client server:

    ```bash
    cd client
    pnpm devA # You can also use {devB, devC}
    ```

* The client game should now be up, and you can use W (up), S (down), A (left), and D (right) to navigate.

This README would normally document whatever steps are necessary to get your application up and running.


### Manual setup (WIP) 

* Set up local network
``` 
anvil
```

* Compile circuit
```
cd circuits/
pnpm dev:move
# This takes a while: it compiles the circuit and runs a smoke test
```

* Deploy contracts
```
cd contracts/scripts
bash forge_create_local_verifier.sh
# copy over deploy address to verifierContract in contract/src/NStates.sol
bash forge_create_local.sh
# copy over deploy address to CONTRACT_ADDR in .env
```

* Run server
```
cd enclave/
pnpm dev
# Wait for "Server running..." log
```

* Run client
``` 
cd client/
pnpm devA  # can also do {devB, devC}
```

###  To run the testcases ###
TBD

### Deployment instructions ###
TBD

### Code guidelines ###

TBD

### Who do I talk to? ###

* Contact Seismic team 
