#! /bin/bash

ARCH=$1
PTAU=$2

# virtual_cpp
circom virtual/virtual.circom --c --r1cs

# Generate witness generator
awk '/#include/ {print; next} !p {print "namespace CIRCUIT_NAME {\n"; p=1} {print} END {print "\n}"}' virtual_cpp/virtual.cpp > temp && mv temp virtual_cpp/virtual.cpp

cd circom_c_witness_generator
./witness_generator.sh $ARCH ../virtual_cpp/virtual.cpp ../virtual_cpp/virtual.dat
cd ..

# # virtual.zkey
# yarn run snarkjs groth16 setup virtual.r1cs \
#                                $PTAU \
#                                virtual.zkey

# # Export solidity verifier
# yarn run snarkjs zkey export solidityverifier virtual.zkey \
#                                               VirtualVerifier.sol
# sed -i -e 's/0.6.11;/0.8.13;/g' VirtualVerifier.sol
# mv VirtualVerifier.sol ../contracts/src
