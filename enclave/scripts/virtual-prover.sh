#!/bin/bash

: '
  This script performs the following operations:
  1. Generates the witness file from the given input file.
  2. Executes virtual-prover (rapidsnark prover) to generate proof-${ID}.json and 
  public-${ID}.json.

  This script generates files, in the bin directory with "-$ID" appended to 
  their names. rm -rf bin/*-$ID.json should be called after reading to save space.
'

ID=$1

../circuits/virtual/virtual-witness-generator bin/input-${ID}.json bin/witness-${ID}.wtns
../circuits/virtual/virtual-prover ../circuits/virtual/virtual.zkey bin/witness-${ID}.wtns bin/proof-${ID}.json bin/public-${ID}.json
