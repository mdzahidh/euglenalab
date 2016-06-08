#!/bin/bash

# For the webserver for external and internal packets
sudo iptables -t nat -A PREROUTING -p tcp --dport 80 -j REDIRECT --to-port 3000
sudo iptables -t nat -I OUTPUT -p tcp -o lo --dport 80 -j REDIRECT --to-ports 3000

# For the BPU Cameras for external packets
sudo iptables -t nat -A PREROUTING -p tcp --dport 20090 -j DNAT --to 192.168.1.218:8080
sudo iptables -t nat -A PREROUTING -p tcp --dport 20095 -j DNAT --to 192.168.1.219:8080
sudo iptables -t nat -A PREROUTING -p tcp --dport 20100 -j DNAT --to 192.168.1.220:8080

# For the BPU Cameras for internal packets
sudo iptables -t nat -I OUTPUT -p tcp -o lo --dport 20090 -j DNAT --to 192.168.1.218:8080
sudo iptables -t nat -I OUTPUT -p tcp -o lo --dport 20095 -j DNAT --to 192.168.1.219:8080
sudo iptables -t nat -I OUTPUT -p tcp -o lo --dport 20100 -j DNAT --to 192.168.1.220:8080

# Enabling port forwarding for the BPUs
sudo iptables -A FORWARD -d 192.168.1.218 -p tcp --dport 8080 -j ACCEPT
sudo iptables -A FORWARD -d 192.168.1.219 -p tcp --dport 8080 -j ACCEPT
sudo iptables -A FORWARD -d 192.168.1.220 -p tcp --dport 8080 -j ACCEPT

sudo sysctl net.ipv4.ip_forward=1