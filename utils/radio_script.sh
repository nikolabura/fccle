#!/bin/bash
ARG=$@
ARGM=$(cut -d "/" -f2- <<< "$ARG")
ARGD=$(cut -d "/" -f2- <<< "$ARGM")
a=$(bc<<<1000*$ARGD)
sleep 0.3
wmctrl -a Gqrx
sleep 0.3
xdotool mousemove 1772 204
sleep 0.2
xdotool click 1
sleep 0.8
xdotool key Delete
xdotool key Delete
xdotool key Delete
xdotool key Delete
xdotool key Delete
xdotool key Delete
xdotool key Delete
xdotool key Delete
xdotool key Delete
xdotool key Delete
sleep 0.9
xdotool type --delay 1000 "$a"
sleep 1
xdotool key Return
