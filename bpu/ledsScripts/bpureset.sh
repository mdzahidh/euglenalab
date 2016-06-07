#!/bin/bash

pins="5 6 9 10 11 12"
echo "Resetting pins" $pins
for p in $pins
do
    gpio mode $p out
    gpio write $p 0
done
echo "Done!"
