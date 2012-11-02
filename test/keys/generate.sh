#!/bin/bash

ssh-keygen -f $1 -b 1022 -N "" -q
ssh-keygen -e -f $1.pub -m PEM > $1.pem
