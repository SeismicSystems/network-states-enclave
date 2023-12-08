#!/bin/bash

: '
  In execution, this script is managed by PM2. On startup, yarn dev is called.
  In case the enclave crashes, yarn dev:recover is called.
'

if [ -f "encryption_key.txt" ]
then
    yarn dev:recover
else
    touch encryption_key.txt
    yarn dev
fi
