#!/bin/bash

# Check if the user provided a command
if [ $# -eq 0 ]; then
    echo "Usage: $0 <command>"
    exit 1
fi

# Execute the provided command and pass all arguments to it
"$@" &

# Store the PID of the command
PID=$!

# Wait until Ctrl+C is pressed
wait $PID
echo -e "\nDone!"
while true; do
    sleep 1
done
