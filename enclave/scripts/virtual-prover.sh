#!/bin/bash

: '
  This script performs the following operations:
  1. Generates the witness file from the given input file.
  2. Executes virtual-prover (rapidsnark prover) to generate the proof-$ID.json 
  and public-$ID.json.

  This script generates files that should be eventually be removed to save 
  space.
'

ID=$1

../circuits/virtual/virtual-witness-generator input-${ID}.json witness-${ID}.wtns
../circuits/virtual/virtual-prover ../circuits/virtual/virtual.zkey witness-${ID}.wtns proof-${ID}.json public-${ID}.json
