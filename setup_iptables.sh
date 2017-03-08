#!/bin/bash

# Check deployment.js
PUBLIC_IP="171.65.102.112"
LOCAL_IP="192.168.1.100"
PUBLIC_PORT="3000"

BPU_LIST="1 2 3"

# Reseting the iptable
sudo iptables --policy INPUT   ACCEPT;
sudo iptables --policy OUTPUT  ACCEPT;
sudo iptables --policy FORWARD ACCEPT;

sudo iptables -Z; # zero counters
sudo iptables -F; # flush (delete) rules
sudo iptables -X; # delete all extra chains

# For the webserver for external and internal packets
sudo iptables -t nat -A PREROUTING -p tcp --dport 80 -j REDIRECT --to-port $PUBLIC_PORT
sudo iptables -t nat -I OUTPUT -p tcp -o lo --dport 80 -j REDIRECT --to-ports $PUBLIC_PORT

echo "Setting up Camera Output Ports"
for bpu in $BPU_LIST
do
    echo $((20000+5*bpu))
    echo 192.168.1.$((bpu + 200))
    # For the BPU Cameras for external packets
    sudo iptables -t nat -A PREROUTING -p tcp --dport $((20000+5*bpu)) -j DNAT --to 192.168.1.$((bpu + 200)):8080

    # Enabling port forwarding for the BPUs
    sudo iptables -A FORWARD -d 192.168.1.$((bpu + 200)) -p tcp --dport 8080 -j ACCEPT
done

sudo iptables -t nat -A POSTROUTING -j MASQUERADE

echo "Setting up Camera Input Ports"
for bpu in $BPU_LIST
do
    # For the BPU Cameras for internal packets
    sudo iptables -t nat -I OUTPUT -p tcp -o lo --dport $((20000+5*bpu)) -j DNAT --to 192.168.1.$((bpu + 200)):8080
done

# So that Public IP addresses works internally too
sudo iptables -t nat -I OUTPUT -p tcp -d $PUBLIC_IP -j DNAT --to $LOCAL_IP
sudo iptables -t nat -I OUTPUT -p tcp --dport 80 -d $PUBLIC_IP -j DNAT --to $LOCAL_IP:$PUBLIC_PORT

for bpu in $BPU_LIST
do
    # For the BPU Cameras for internal packets
    sudo iptables -t nat -I OUTPUT -p tcp --dport $((20000+5*bpu)) -d $PUBLIC_IP -j DNAT --to 192.168.1.$((bpu + 200)):8080
done

sudo sysctl net.ipv4.ip_forward=1