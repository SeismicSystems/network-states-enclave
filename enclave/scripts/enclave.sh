#!/bin/bash

: '
  In execution, this script is managed by PM2. On startup, yarn start is called.
  In case the enclave crashes, yarn start:recover is called.
'

if [ -f "encryption_key.txt" ]
then
    yarn start:recover
else
    touch encryption_key.txt
    yarn start
fi
