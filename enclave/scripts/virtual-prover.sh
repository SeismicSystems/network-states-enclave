#!/bin/bash

../circuits/virtual/virtual-witness-generator input.json witness.wtns
../circuits/virtual/virtual-prover ../circuits/virtual/virtual.zkey witness.wtns proof.json public.json

rm input.json witness.wtns proof.json public.json