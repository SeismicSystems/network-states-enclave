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

* Clone the repository.
* Make sure you have the `.env` file (you can ask the repository manager to provide it).
* Set up PNPM and yarn
 ```bash
npm install -g pnpm
npm install -g yarn
```
* Set up Foundary in local network
 ```bash
curl -L https://foundry.paradigm.xyz | bash
. /root/.bashrc
foundryup
```
* Setup postgres in local or u can use below docker command to setup postgres
 ```bash
docker run --name some-postgres -e  POSTGRES_USER=postgres -e POSTGRES_PASSWORD=password -e POSTGRES_DB=networkstates -p 5432:5432 -d postgres
```
* Compile circuit
 ```bash
cd circuits
yarn
mkdir artifacts
cd artifacts
wget https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_17.ptau
cd ..
yarn dev
cd ..
# This takes a while: it compiles the circuit and runs a smoke test
```

* Deploy contracts
 ```bash
cd contracts
pnpm build
pnpm dev
```

* Run server
 ```bash
cd game
pnpm install
cd ..

cd enclave
pnpm install
pnpm dev
# Wait for "Server running..." log
```
* Run DA server
 ```bash
cd DA
pnpm install
pnpm dev
```
* Run client
 ```bash
cd client
pnpm install
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
