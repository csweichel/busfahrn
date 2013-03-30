#!/bin/bash

usage="usage: $0 <username> <host>"
username="$1"
host="$2"

if test "x$username" == "x"
then
    echo $usage
    exit 1
fi

if test "x$host" == "x"
then
    echo $usage
    exit 1
fi

pid_file="/opt/busfahrn/tmp/pid/ssh_${username}_${host}.pid"
if [[ ! -f $pid_file || ! $(pgrep -c -F $pid_file) -eq 1 ]]; then
    ping -c 1 -W 5 $host || killall ssh
    ssh -N -T -R $host:3000:localhost:8888 $username@$host &> /dev/null &
    echo $! > $pid_file
fi

#
