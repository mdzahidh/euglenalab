#!/bin/bash

PUBLIC_IP="171.65.102.104"

# Reseting the iptable
sudo iptables --policy INPUT   ACCEPT;
sudo iptables --policy OUTPUT  ACCEPT;
sudo iptables --policy FORWARD ACCEPT;

sudo iptables -Z; # zero counters
sudo iptables -F; # flush (delete) rules
sudo iptables -X; # delete all extra chains

# For the webserver for external and internal packets
sudo iptables -t nat -A PREROUTING -p tcp --dport 80 -j REDIRECT --to-port 3000
sudo iptables -t nat -I OUTPUT -p tcp -o lo --dport 80 -j REDIRECT --to-ports 3000

# For the BPU Cameras for external packets
sudo iptables -t nat -A PREROUTING -p tcp --dport 20090 -j DNAT --to 192.168.1.218:8080
sudo iptables -t nat -A PREROUTING -p tcp --dport 20095 -j DNAT --to 192.168.1.219:8080
sudo iptables -t nat -A PREROUTING -p tcp --dport 20100 -j DNAT --to 192.168.1.220:8080

# Enabling port forwarding for the BPUs
sudo iptables -A FORWARD -d 192.168.1.218 -p tcp --dport 8080 -j ACCEPT
sudo iptables -A FORWARD -d 192.168.1.219 -p tcp --dport 8080 -j ACCEPT
sudo iptables -A FORWARD -d 192.168.1.220 -p tcp --dport 8080 -j ACCEPT

sudo iptables -t nat -A POSTROUTING -j MASQUERADE

# For the BPU Cameras for internal packets
sudo iptables -t nat -I OUTPUT -p tcp -o lo --dport 20090 -j DNAT --to 192.168.1.218:8080
sudo iptables -t nat -I OUTPUT -p tcp -o lo --dport 20095 -j DNAT --to 192.168.1.219:8080
sudo iptables -t nat -I OUTPUT -p tcp -o lo --dport 20100 -j DNAT --to 192.168.1.220:8080


# So that Public IP addresses works internally too
sudo iptables -t nat -I OUTPUT -p tcp -d $PUBLIC_IP -j DNAT --to 192.168.1.100
sudo iptables -t nat -I OUTPUT -p tcp --dport 80 -d $PUBLIC_IP -j DNAT --to 192.168.1.100:3000
# sudo iptables -t nat -I OUTPUT -p tcp --dport 2000 -d $PUBLIC_IP -j DNAT --to 192.168.1.100:2000
# sudo iptables -t nat -I OUTPUT -p tcp --dport 3000 -d $PUBLIC_IP -j DNAT --to 192.168.1.100:3000
# sudo iptables -t nat -I OUTPUT -p tcp --dport 4000 -d $PUBLIC_IP -j DNAT --to 192.168.1.100:4000
# sudo iptables -t nat -I OUTPUT -p tcp --dport 5000 -d $PUBLIC_IP -j DNAT --to 192.168.1.100:5000


# sudo iptables -t nat -I OUTPUT -p tcp --dport 8080 -d $PUBLIC_IP -j DNAT --to 192.168.1.100:8080
# sudo iptables -t nat -I OUTPUT -p tcp --dport 8081 -d $PUBLIC_IP -j DNAT --to 192.168.1.100:8081
# sudo iptables -t nat -I OUTPUT -p tcp --dport 8082 -d $PUBLIC_IP -j DNAT --to 192.168.1.100:8082
# sudo iptables -t nat -I OUTPUT -p tcp --dport 8083 -d $PUBLIC_IP -j DNAT --to 192.168.1.100:8083
# sudo iptables -t nat -I OUTPUT -p tcp --dport 8084 -d $PUBLIC_IP -j DNAT --to 192.168.1.100:8084
# sudo iptables -t nat -I OUTPUT -p tcp --dport 8085 -d $PUBLIC_IP -j DNAT --to 192.168.1.100:8085

sudo iptables -t nat -I OUTPUT -p tcp --dport 20090 -d $PUBLIC_IP -j DNAT --to 192.168.1.218:8080
sudo iptables -t nat -I OUTPUT -p tcp --dport 20095 -d $PUBLIC_IP -j DNAT --to 192.168.1.219:8080
sudo iptables -t nat -I OUTPUT -p tcp --dport 20100 -d $PUBLIC_IP -j DNAT --to 192.168.1.220:8080

sudo sysctl net.ipv4.ip_forward=1
