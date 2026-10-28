"""Moves and clicks the real X11 pointer (XTEST), so tests can drive the real Electron window like a user.
usage: xmouse.py move X Y | click [button] | scroll up|down
"""
import sys
from Xlib import X, display
from Xlib.ext import xtest

d = display.Display()
cmd = sys.argv[1]
if cmd == 'move':
    xtest.fake_input(d, X.MotionNotify, x=int(sys.argv[2]), y=int(sys.argv[3]))
elif cmd == 'click':
    b = int(sys.argv[2]) if len(sys.argv) > 2 else 1
    xtest.fake_input(d, X.ButtonPress, b)
    d.sync()
    xtest.fake_input(d, X.ButtonRelease, b)
elif cmd == 'scroll':
    b = 4 if sys.argv[2] == 'up' else 5
    xtest.fake_input(d, X.ButtonPress, b)
    d.sync()
    xtest.fake_input(d, X.ButtonRelease, b)
d.sync()
