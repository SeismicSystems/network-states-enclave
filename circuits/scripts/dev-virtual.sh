#! /bin/bash

: '
  This script performs the following operations:
  1. Compiles the circuit file virtual.circom using the circom compiler.
  2. Computes virtual.zkey.
  2. Generates a witness gen executable using circom_c_witness_generator repo.
  3. Compiles a prover executable using the rapidsnark repo.
  4. Exports a solidity verifier using snarkjs and the virtual.zkey file.
'

ARCH=$1
PTAU=$2

# virtual_cpp and js
circom2 virtual/virtual.circom --c --r1cs --wasm

# Generate proving key
yarn run snarkjs groth16 setup virtual.r1cs \
  $PTAU \
  virtual.zkey

# Generate verifying key
yarn run snarkjs zkey export verificationkey virtual.zkey \
  virtual.vkey.json

# Compute witness, used as smoke test for circuit
node virtual_js/generate_witness.js \
  virtual_js/virtual.wasm \
  virtual/virtual.smoke.json \
  virtual.wtns

# Export solidity verifier
yarn run snarkjs zkey export solidityverifier virtual.zkey \
  virtualVerifier.sol
sed -i -e 's/0.6.11;/0.8.13;/g' virtualVerifier.sol
mv virtualVerifier.sol ../contracts/src/VirtualVerifier.sol

# Save proving key and witness generation script
mv virtual_js/virtual.wasm virtual.zkey virtual/

# Generate witness generator
awk '/#include/ {print; next} !p {print "namespace CIRCUIT_NAME {\n"; p=1} {print} END {print "\n}"}' virtual_cpp/virtual.cpp >temp && mv temp virtual_cpp/virtual.cpp

# Clone circom_c_witness_generator
git clone https://github.com/bajpai244/circom_c_witness_generator.git
cd circom_c_witness_generator

./witness_generator.sh $ARCH ../virtual_cpp/virtual.cpp ../virtual_cpp/virtual.dat
mv wtns_build/circuit ../virtual/virtual-witness-generator
mv ../virtual_cpp/virtual.dat ../virtual/virtual-witness-generator.dat
cd ..

rm -rf circom_c_witness_generator
rm -rf virtual.r1cs virtual_cpp virtualVerifier.sol-e
rm -rf virtual.vkey.json virtual.wtns virtual_js

# Clone and compile rapidsnark
git clone https://github.com/iden3/rapidsnark.git
cd rapidsnark
CURRENT_DIR=$(pwd)

git submodule init
git submodule update

if [ "$ARCH" = "x86_64" ]; then
  ./build_gmp.sh host
  mkdir build_prover && cd build_prover
  cmake .. -DCMAKE_BUILD_TYPE=Release -DCMAKE_INSTALL_PREFIX=../package
  make -j4 && make install

  cd $CURRENT_DIR
  cp package/bin/prover ../virtual/virtual-prover
elif [ "$ARCH" = "arm64" ]; then
  ./build_gmp.sh macos_arm64
  mkdir build_prover_macos_arm64 && cd build_prover_macos_arm64
  cmake .. -DTARGET_PLATFORM=macos_arm64 -DCMAKE_BUILD_TYPE=Release -DCMAKE_INSTALL_PREFIX=../package_macos_arm64
  make -j4 && make install

  cd $CURRENT_DIR
  cp package_macos_arm64/bin/prover ../virtual/virtual-prover
fi
cd $CURRENT_DIR
cd ..
rm -rf rapidsnark
